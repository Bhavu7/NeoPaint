document.addEventListener("DOMContentLoaded", () => {
  // Canvas setup
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  const canvasContainer = document.querySelector(".canvas-container");
  const canvasOverlay = document.getElementById("canvas-overlay");
  const overlayCtx = canvasOverlay.getContext("2d");

  // State variables
  let isDrawing = false;
  let currentTool = "brush";
  let currentColor = "#4f46e5";
  let brushSize = 5;
  let opacity = 1;
  let startX, startY;
  let snapshot;
  let drawingHistory = [];
  let historyIndex = -1;
  let zoomLevel = 1;
  let toolbarOpen = true;
  let textInput = "";

  // UI elements
  const toolbar = document.querySelector(".toolbar");
  const toolbarToggle = document.getElementById("toolbar-toggle");
  const toolButtons = document.querySelectorAll(".tool-btn");
  const colorOptions = document.querySelectorAll(".color-option");
  const customColor = document.getElementById("custom-color");
  const brushSizeInput = document.getElementById("brush-size");
  const brushSizeValue = document.getElementById("brush-size-value");
  const opacityInput = document.getElementById("opacity");
  const opacityValue = document.getElementById("opacity-value");
  const clearBtn = document.getElementById("clear-btn");
  const saveBtn = document.getElementById("save-btn");
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const cursorPosition = document.getElementById("cursor-position");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const resetZoomBtn = document.getElementById("reset-zoom");
  const zoomLevelDisplay = document.getElementById("zoom-level");
  const notification = document.getElementById("notification");
  const notificationText = document.getElementById("notification-text");
  const loading = document.getElementById("loading");

  // Initialize canvas
  function initCanvas() {
    // Show loading indicator
    showLoading();

    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    canvas.width = containerWidth * 0.9;
    canvas.height = containerHeight * 0.9;
    canvasOverlay.width = canvas.width;
    canvasOverlay.height = canvas.height;

    // Set canvas background to white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state to history
    saveCanvasState();

    // Hide loading indicator
    hideLoading();
  }

  // Save canvas state to history
  function saveCanvasState() {
    // If we're not at the end of history, remove future states
    if (historyIndex < drawingHistory.length - 1) {
      drawingHistory = drawingHistory.slice(0, historyIndex + 1);
    }

    // Save current canvas state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    drawingHistory.push(imageData);
    historyIndex++;

    // Update undo/redo buttons
    updateHistoryButtons();
  }

  // Update undo/redo buttons state
  function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= drawingHistory.length - 1;
  }

  // Undo last action
  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      ctx.putImageData(drawingHistory[historyIndex], 0, 0);
      updateHistoryButtons();
      showNotification("Action undone", "fa-undo");
    }
  }

  // Redo last undone action
  function redo() {
    if (historyIndex < drawingHistory.length - 1) {
      historyIndex++;
      ctx.putImageData(drawingHistory[historyIndex], 0, 0);
      updateHistoryButtons();
      showNotification("Action redone", "fa-redo");
    }
  }

  // Clear canvas
  function clearCanvas() {
    // Add animation effect
    canvas.classList.add("pulse");
    setTimeout(() => {
      canvas.classList.remove("pulse");
    }, 600);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();
    showNotification("Canvas cleared", "fa-trash");
  }

  // Save canvas as image
  function saveCanvas() {
    // Show loading indicator
    showLoading();

    setTimeout(() => {
      const link = document.createElement("a");
      link.download = "neopaint_artwork.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      hideLoading();
      showNotification("Artwork saved", "fa-check-circle");
    }, 300);
  }

  // Show notification
  function showNotification(message, icon = "fa-check-circle") {
    notificationText.textContent = message;
    notification.querySelector("i").className = `fas ${icon}`;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  // Show loading indicator
  function showLoading() {
    loading.classList.add("show");
  }

  // Hide loading indicator
  function hideLoading() {
    loading.classList.remove("show");
  }

  // Toggle toolbar
  function toggleToolbar() {
    toolbar.classList.toggle("collapsed");
    toolbarOpen = !toolbarOpen;

    const icon = toolbarToggle.querySelector("i");
    if (toolbarOpen) {
      icon.className = "fas fa-chevron-left";
    } else {
      icon.className = "fas fa-chevron-right";
    }
  }

  // Start drawing
  function startDraw(e) {
    isDrawing = true;

    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Calculate position with zoom accounted for
    startX = ((e.clientX - rect.left) * scaleX) / zoomLevel;
    startY = ((e.clientY - rect.top) * scaleY) / zoomLevel;

    // Save current canvas state for shapes and other tools
    if (["line", "rectangle", "circle"].includes(currentTool)) {
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Show overlay canvas for preview
      canvasOverlay.style.display = "block";
    }

    // Handle fill tool immediately
    if (currentTool === "fill") {
      floodFill(Math.floor(startX), Math.floor(startY));
    }

    // Handle eyedropper tool immediately
    if (currentTool === "eyedropper") {
      pickColor(Math.floor(startX), Math.floor(startY));
    }

    // Handle text tool
    if (currentTool === "text") {
      textInput = prompt("Enter text:");
      if (textInput) {
        const fontSize = brushSize * 2; // Scale font size based on brush size
        ctx.fillStyle = currentColor;
        ctx.globalAlpha = opacity;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(textInput, startX, startY);
        saveCanvasState();
      }
    }
  }

  // Draw
  function draw(e) {
    if (!isDrawing) return;

    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = ((e.clientX - rect.left) * scaleX) / zoomLevel;
    const y = ((e.clientY - rect.top) * scaleY) / zoomLevel;

    // Update cursor position display
    cursorPosition.textContent = `X: ${Math.floor(x)}, Y: ${Math.floor(y)}`;

    // Handle different tools
    switch (currentTool) {
      case "brush":
        drawBrush(x, y);
        break;

      case "eraser":
        erase(x, y);
        break;

      case "line":
        drawShape("line", x, y);
        break;

      case "rectangle":
        drawShape("rectangle", x, y);
        break;

      case "circle":
        drawShape("circle", x, y);
        break;
    }
  }

  // End drawing
  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;

    // For shape tools, apply the final shape to the main canvas
    if (["line", "rectangle", "circle"].includes(currentTool)) {
      ctx.drawImage(canvasOverlay, 0, 0);
      canvasOverlay.style.display = "none";
      overlayCtx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

      // Save state after drawing a shape
      saveCanvasState();
    }

    // For brush and eraser, save state when stopped drawing
    if (["brush", "eraser"].includes(currentTool)) {
      saveCanvasState();
    }
  }

  // Draw with brush
  function drawBrush(x, y) {
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();

    startX = x;
    startY = y;
  }

  // Erase
  function erase(x, y) {
    ctx.globalAlpha = 1; // Eraser is always fully opaque
    ctx.strokeStyle = "#ffffff"; // Eraser uses white color
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();

    startX = x;
    startY = y;
  }

  // Draw shapes (line, rectangle, circle)
  function drawShape(shape, x, y) {
    // Clear the overlay and restore the original canvas
    overlayCtx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    overlayCtx.putImageData(snapshot, 0, 0);

    // Set drawing properties
    overlayCtx.globalAlpha = opacity;
    overlayCtx.strokeStyle = currentColor;
    overlayCtx.lineWidth = brushSize;
    overlayCtx.lineCap = "round";
    overlayCtx.lineJoin = "round";

    // Draw shape preview
    switch (shape) {
      case "line":
        overlayCtx.beginPath();
        overlayCtx.moveTo(startX, startY);
        overlayCtx.lineTo(x, y);
        overlayCtx.stroke();
        break;

      case "rectangle":
        const rectWidth = x - startX;
        const rectHeight = y - startY;
        overlayCtx.strokeRect(startX, startY, rectWidth, rectHeight);
        break;

      case "circle":
        const radius = Math.sqrt(
          Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
        );
        overlayCtx.beginPath();
        overlayCtx.arc(startX, startY, radius, 0, Math.PI * 2);
        overlayCtx.stroke();
        break;
    }
  }

  // Flood fill algorithm
  function floodFill(x, y) {
    // Get the clicked pixel color
    const targetColor = ctx.getImageData(x, y, 1, 1).data;
    const targetRGBA = `${targetColor[0]},${targetColor[1]},${targetColor[2]},${targetColor[3]}`;

    // Parse the current color
    const fillColor = hexToRgb(currentColor);
    const fillRGBA = `${fillColor.r},${fillColor.g},${fillColor.b},${Math.floor(
      opacity * 255
    )}`;

    // If target color is the same as fill color, do nothing
    if (targetRGBA === fillRGBA) return;

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Queue for flood fill
    const queue = [];
    queue.push([x, y]);

    // Process queue
    while (queue.length > 0) {
      const [currX, currY] = queue.shift();

      // Check if pixel is out of bounds
      if (currX < 0 || currY < 0 || currX >= width || currY >= height) continue;

      // Get current pixel index
      const index = (currY * width + currX) * 4;

      // Check if pixel matches target color
      if (
        pixels[index] === targetColor[0] &&
        pixels[index + 1] === targetColor[1] &&
        pixels[index + 2] === targetColor[2] &&
        pixels[index + 3] === targetColor[3]
      ) {
        // Fill the pixel
        pixels[index] = fillColor.r;
        pixels[index + 1] = fillColor.g;
        pixels[index + 2] = fillColor.b;
        pixels[index + 3] = Math.floor(opacity * 255);

        // Add adjacent pixels to queue
        queue.push([currX + 1, currY]);
        queue.push([currX - 1, currY]);
        queue.push([currX, currY + 1]);
        queue.push([currX, currY - 1]);
      }
    }

    // Update canvas with filled area
    ctx.putImageData(imageData, 0, 0);
    saveCanvasState();
  }

  // Pick color with eyedropper
  function pickColor(x, y) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = rgbToHex(pixel[0], pixel[1], pixel[2]);

    // Update current color
    currentColor = color;
    customColor.value = color;

    // Deselect all color options
    colorOptions.forEach((option) => option.classList.remove("selected"));

    showNotification("Color picked: " + color, "fa-eye-dropper");
  }

  // Helper function to convert hex to RGB
  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace("#", "");

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
  }

  // Helper function to convert RGB to hex
  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  // Zoom functions
  function zoomIn() {
    if (zoomLevel < 5) {
      zoomLevel += 0.25;
      applyZoom();
    }
  }

  function zoomOut() {
    if (zoomLevel > 0.25) {
      zoomLevel -= 0.25;
      applyZoom();
    }
  }

  function resetZoom() {
    zoomLevel = 1;
    applyZoom();
  }

  function applyZoom() {
    canvas.style.transform = `scale(${zoomLevel})`;
    canvasOverlay.style.transform = `scale(${zoomLevel})`;
    zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  // Handle window resize
  function handleResize() {
    // Save current canvas image
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);

    // Resize canvas
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    canvas.width = containerWidth * 0.9;
    canvas.height = containerHeight * 0.9;
    canvasOverlay.width = canvas.width;
    canvasOverlay.height = canvas.height;

    // Restore canvas image
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    // Update history
    drawingHistory = [];
    historyIndex = -1;
    saveCanvasState();
  }

  // Event listeners
  canvas.addEventListener("mousedown", startDraw);
  document.addEventListener("mousemove", draw);
  document.addEventListener("mouseup", endDraw);
  document.addEventListener("mouseout", endDraw);

  // Touch support
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    document.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup", {});
    document.dispatchEvent(mouseEvent);
  });

  // Tool buttons
  toolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all buttons
      toolButtons.forEach((b) => b.classList.remove("active"));

      // Add active class to clicked button
      btn.classList.add("active");

      // Set current tool
      currentTool = btn.getAttribute("data-tool");

      // Update cursor based on tool
      if (currentTool === "eyedropper") {
        canvas.style.cursor = "crosshair";
      } else if (currentTool === "text") {
        canvas.style.cursor = "text";
      } else {
        canvas.style.cursor = "crosshair";
      }

      showNotification(
        `Tool selected: ${currentTool}`,
        `fa-${btn.querySelector("i").className.split("fa-")[1]}`
      );
    });
  });

  // Color options
  colorOptions.forEach((option) => {
    option.addEventListener("click", () => {
      // Remove selected class from all options
      colorOptions.forEach((opt) => opt.classList.remove("selected"));

      // Add selected class to clicked option
      option.classList.add("selected");

      // Set current color
      currentColor = option.getAttribute("data-color");
      customColor.value = currentColor;
    });
  });

  // Custom color picker
  customColor.addEventListener("input", () => {
    currentColor = customColor.value;

    // Deselect all color options
    colorOptions.forEach((option) => option.classList.remove("selected"));
  });

  // Brush size input
  brushSizeInput.addEventListener("input", () => {
    brushSize = parseInt(brushSizeInput.value);
    brushSizeValue.textContent = `${brushSize}px`;
  });

  // Opacity input
  opacityInput.addEventListener("input", () => {
    opacity = parseInt(opacityInput.value) / 100;
    opacityValue.textContent = `${opacityInput.value}%`;
  });

  // Clear button
  clearBtn.addEventListener("click", clearCanvas);

  // Save button
  saveBtn.addEventListener("click", saveCanvas);

  // Undo button
  undoBtn.addEventListener("click", undo);

  // Redo button
  redoBtn.addEventListener("click", redo);

  // Toolbar toggle
  toolbarToggle.addEventListener("click", toggleToolbar);

  // Zoom controls
  zoomInBtn.addEventListener("click", zoomIn);
  zoomOutBtn.addEventListener("click", zoomOut);
  resetZoomBtn.addEventListener("click", resetZoom);

  // Window resize event
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 300);
  });

  // Initialize canvas when DOM is loaded
  initCanvas();

  // Select the first color option
  colorOptions[0].click();

  // Welcome notification
  setTimeout(() => {
    showNotification("Welcome to NeoPaint! Start drawing...", "fa-palette");
  }, 1000);
});
