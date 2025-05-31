export class SVGFitZoom {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isPanning = false;
        this.startPanPoint = { x: 0, y: 0 };
        this.initialScale = 1;
        this.minScale = 0.1;
        this.maxScale = 10;
        this.zoomSensitivity = 0.001;

        this.init();
    }

    init() {
        // Set up observer for dynamically loaded SVGs
        this.observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length)) {
                this.setupSVG();
            }
        });
        this.observer.observe(this.container, { childList: true });

        // Initial setup
        this.setupSVG();
        this.setupEvents();
        this.styleElements();
    }

    setupSVG() {
        this.svg = this.container.querySelector('svg');
        if (!this.svg) return;

        // Store original dimensions
        const computedStyle = window.getComputedStyle(this.svg);
        this.originalWidth = parseInt(computedStyle.width, 10);
        this.originalHeight = parseInt(computedStyle.height, 10);

        // Calculate initial scale to fit container
        this.calculateInitialScale();
        this.updateTransform();
    }

    calculateInitialScale() {
        const containerWidth = this.container.clientWidth;
        this.initialScale = containerWidth / this.originalWidth;
        return this.initialScale;
    }

    updateTransform() {
        if (!this.svg) return;

        const totalScale = this.initialScale * this.scale;
        this.svg.style.transform = `
      translate(${this.translateX}px, ${this.translateY}px)
      scale(${totalScale})
    `;
        this.svg.style.transformOrigin = '0 0';
    }

    setupEvents() {
        // Zoom with mouse wheel
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Pan with mouse drag
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        document.addEventListener('mouseleave', () => this.handleMouseUp());

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    styleElements() {
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';

        if (this.svg) {
            this.svg.style.pointerEvents = 'auto';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        if (!this.svg) return;

        // Get mouse position relative to SVG
        const rect = this.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate zoom direction (inverted for natural feeling)
        const wheelDelta = -e.deltaY;
        const zoomFactor = Math.exp(wheelDelta * this.zoomSensitivity);
        const newScale = Math.min(Math.max(this.minScale, this.scale * zoomFactor), this.maxScale);

        // Calculate new translation to zoom toward mouse
        const scaleChange = newScale / this.scale;
        this.translateX -= (mouseX - this.translateX) * (scaleChange - 1);
        this.translateY -= (mouseY - this.translateY) * (scaleChange - 1);

        this.scale = newScale;
        this.updateTransform();
    }

    handleMouseDown(e) {
        if (e.button === 0) { // Left mouse button only
            e.preventDefault();
            this.isPanning = true;
            this.startPanPoint = {
                x: e.clientX - this.translateX,
                y: e.clientY - this.translateY
            };
            this.container.style.cursor = 'grabbing';
        }
    }

    handleMouseMove(e) {
        if (!this.isPanning) return;
        e.preventDefault();

        this.translateX = e.clientX - this.startPanPoint.x;
        this.translateY = e.clientY - this.startPanPoint.y;
        this.updateTransform();
    }

    handleMouseUp() {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = 'grab';
        }
    }

    handleResize() {
        if (!this.svg) return;

        // Calculate current visible center in SVG coordinates
        const containerRect = this.container.getBoundingClientRect();
        const visibleCenterX = (-this.translateX + containerRect.width / 2) / (this.initialScale * this.scale);
        const visibleCenterY = (-this.translateY + containerRect.height / 2) / (this.initialScale * this.scale);

        // Recalculate base scale
        const oldInitialScale = this.initialScale;
        this.calculateInitialScale();

        // Maintain the same center point after resize
        this.translateX = containerRect.width / 2 - visibleCenterX * (this.initialScale * this.scale);
        this.translateY = containerRect.height / 2 - visibleCenterY * (this.initialScale * this.scale);

        this.updateTransform();
    }

    reset() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.calculateInitialScale();
        this.updateTransform();
    }
}
