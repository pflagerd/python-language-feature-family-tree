import express from 'express';                                                                                         // Imports the Express framework to build the web server.
import https from 'https';                                                                                             // Built-in Node.js module to create an HTTPS server (as opposed to HTTP).
import {readFileSync, statSync, existsSync} from 'fs';                                                               // Node.js file system methods for reading files and checking if they exist or are files.
import {join} from 'path';                                                                                           // path.join safely joins paths for all operating systems.
import chokidar from 'chokidar';                                                                                       // A powerful file watcher to detect changes in the file system in real-time.
import {WebSocketServer} from 'ws';                                                                                  // A WebSocket server using the ws library to push reload commands to connected browsers.
import {fileURLToPath} from 'url';                                                                                   // Required in ES modules to get the current file’s directory path.
import {dirname} from 'path';                                                                                        // Required in ES modules to get the current file’s directory path.
import {spawn} from 'child_process';
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));                                                       // ES module alternative to __dirname. Gets the absolute path of the directory where the current file resides.
const certDir = join(__dirname, 'cert');                                                                         // certDir: path to the folder where HTTPS certs live
const PORT = process.env.PORT || 2443;                                                                    // PORT: configurable port with default fallback to 2443
const debugging = true;                                                                                       // Set this to enable debug logging.

// Parse CLI args for root directory
const args = process.argv.slice(2);                                                                             // Parses --root=some/path from the command line
const rootArg = args.find(arg => arg.startsWith('--root='));
const publicDir = rootArg                                                                                        // Defaults to ./ if not specified
    ? join(__dirname, rootArg.split('=')[1])
    : join(__dirname, './');

console.log(`📂 Serving static files from: ${publicDir}`);

// HTTPS setup
const sslOptions = {                                                              // Reads the key.pem and cert.pem files to set up an HTTPS server
    key: readFileSync(join(certDir, 'key.pem')),
    cert: readFileSync(join(certDir, 'cert.pem')),
};

const app = express();

// Inject WebSocket script into HTML responses
app.use((req, res, next) => {
    if (req.accepts('html')) {                                                                                       // Intercepts HTML file requests, defaults / to /index.html
        const reqPath = req.path.endsWith('/') ? req.path + 'index.html' : req.path;
        const filePath = join(publicDir, reqPath);
        if (existsSync(filePath) && statSync(filePath).isFile() && filePath.endsWith('.html')) {                            // Ensures the file exists and is an actual HTML file
            let raw = readFileSync(filePath, 'utf8');
            const injected = raw.replace(                                                                               // Adds a WebSocket auto-reload script just before </body>
                '</body>',                                                                                            // Client will reconnect to server and reload the page when notified
                `<script>
          const ws = new WebSocket('wss://' + location.host);
          ws.onmessage = () => location.reload();
        </script></body>`
            );
            return res.send(injected);
        }
    }
    next();                                                                                                               // If not an HTML file, just move on to the next middleware
});

app.use(express.static(publicDir));                                                                                     // Standard middleware to serve static files from the chosen directory

const apiKey = process.env.API_KEY;
const anthropic = new Anthropic({ apiKey } );

const systemPrompt = `You are an expert tutor for the Python programming language. Be encouraging, ask follow-up questions to check understanding, and provide clear explanations with examples.`;

let conversationHistory = []

// app.get('/talk', async (req, res) => {
//     try {
//         res.type('text/plain').send("The quick brown fox jumps over the lazy dog.");
//     } catch (error) {
//         res.status(500).send('Error reading file');
//     }
// });


app.get('/talk', async (req, res) => {
    conversationHistory.push({
        role: 'user',
        content: req.query.data,
    });

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            system: systemPrompt,
            messages: conversationHistory
        });

        const tutorResponse = response.content[0].text;
        console.log(tutorResponse);

        // Add Claude's response to history
        conversationHistory.push({
            role: 'assistant',
            content: tutorResponse
        });

        res.type('text/plain').send(tutorResponse);
    } catch (error) {
        throw new Error(`Tutor error: ${error.message}`);
    }
});

// Start HTTPS httpsServer
const httpsServer = https.createServer(sslOptions, app);                        // Creates the HTTPS server ...
const wss = new WebSocketServer({server: httpsServer});                                    // ... and attaches a WebSocket server to it

// Debounced reload sender
let reloadTimeout = null;                                                                                          // Watches for file changes and debounces reload messages (prevents spam reloads)
const debounceTime = 300; // milliseconds

const triggerReload = () => {
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
        wss.clients.forEach(client => {
            if (client.readyState === 1) client.send('reload');
        });
        if (debugging) console.log('♻️  Reload triggered');
    }, debounceTime);
};

// Watch for file changes
chokidar.watch(publicDir, {
    ignoreInitial: true,
    depth: Infinity,
    persistent: true,
    awaitWriteFinish: {stabilityThreshold: 100, pollInterval: 50}
}).on('all', triggerReload);                               // Starts watching the directory and calls triggerReload() on every change (excluding initial scan)

// Launch
httpsServer.listen(PORT, () => {                                                                      // Starts the server on the given port and logs the address
    console.log(`🔐 HTTPS server running at https://localhost:${PORT}`);
});

//const child = spawn('/home/oy753c/bin/activity-chromium-browser', [`https://localhost:${PORT}/python-language-feature-family-tree.html`], {
const child = spawn('/usr/bin/chromium-browser', [`https://localhost:${PORT}/index.html`], {
    detached: true,
    stdio: 'ignore'  // Ignore all output
});
child.unref();
