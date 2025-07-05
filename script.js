class HillChartGenerator {
  constructor() {
    this.svg = document.getElementById("hillChart");
    this.titleInput = document.getElementById("titleInput");
    this.milestoneInput = document.getElementById("milestoneInput");
    this.addMilestoneBtn = document.getElementById("addMilestone");
    this.downloadBtn = document.getElementById("downloadBtn");
    this.clearBtn = document.getElementById("clearBtn");
    this.milestoneList = document.getElementById("milestoneList");
    this.chartTitle = document.getElementById("chartTitle");

    this.milestones = [];
    this.draggedMilestone = null;
    this.dragOrder = 0;
    this.chartWidth = 1200;
    this.chartHeight = 600;
    this.hillStartX = 250;
    this.hillEndX = 950;
    this.hillTopY = 180;
    this.hillBottomY = 480;

    this.init();
  }

  init() {
    this.drawHillCurve();
    this.bindEvents();
    this.loadMilestones();
    this.loadTitle();
  }

  drawHillCurve() {
    const hillCurve = this.svg.querySelector(".hill-curve");
    const path = this.generateHillPath();
    hillCurve.innerHTML = `<path d="${path}" class="hill-path"/>`;
  }

  generateHillPath() {
    // Generate path by sampling points along the normal curve
    const points = [];
    const numPoints = 50;

    for (let i = 0; i <= numPoints; i++) {
      const x =
        this.hillStartX + (this.hillEndX - this.hillStartX) * (i / numPoints);
      const y = this.getHillY(x);
      points.push({ x, y });
    }

    // Build smooth SVG path using quadratic curves
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      // Use quadratic curve to current point with next point as control
      const controlX = (current.x + next.x) / 2;
      const controlY = (current.y + next.y) / 2;
      
      path += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
    }
    
    // Final line to last point
    const lastPoint = points[points.length - 1];
    path += ` T ${lastPoint.x} ${lastPoint.y}`;

    return path;
  }

  bindEvents() {
    this.addMilestoneBtn.addEventListener("click", () => this.addMilestone());
    this.milestoneInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addMilestone();
    });
    this.titleInput.addEventListener("input", (e) => this.updateTitle(e.target.value));
    this.downloadBtn.addEventListener("click", () => this.downloadImage());
    this.clearBtn.addEventListener("click", () => this.clearAll());
  }

  addMilestone() {
    const milestoneName = this.milestoneInput.value.trim();
    if (!milestoneName) return;

    const milestone = {
      id: Date.now(),
      name: milestoneName,
      x: this.hillStartX + (this.hillEndX - this.hillStartX) * 0.1,
      progress: 0.1,
    };

    this.milestones.push(milestone);
    this.milestoneInput.value = "";
    this.render();
    this.saveMilestones();
  }

  removeMilestone(milestoneId) {
    this.milestones = this.milestones.filter(
      (milestone) => milestone.id !== milestoneId
    );
    this.render();
    this.saveMilestones();
  }

  getHillY(x) {
    const totalWidth = this.hillEndX - this.hillStartX;
    const normalizedX = (x - this.hillStartX) / totalWidth;

    // Calculate Y position using normal distribution formula
    // Center the curve at x = 0.5, with smaller standard deviation for steeper curve
    const mean = 0.5;
    const stdDev = 0.15;
    const amplitude = this.hillBottomY - this.hillTopY;

    // Normal distribution formula: e^(-0.5 * ((x - mean) / stdDev)^2)
    const exponent = -0.5 * Math.pow((normalizedX - mean) / stdDev, 2);
    const normalValue = Math.exp(exponent);

    const y = this.hillBottomY - amplitude * normalValue;

    return y;
  }

  render() {
    this.renderMilestonePoints();
    this.renderMilestoneList();
    this.updateCenterLine();
  }

  renderMilestonePoints() {
    const milestonePoints = this.svg.querySelector(".milestone-points");
    milestonePoints.innerHTML = "";

    const activeMilestones = this.milestones;
    
    // Sort milestones by x position for consistent stacking
    const sortedMilestones = [...activeMilestones].sort((a, b) => a.x - b.x);

    // Handle stacking with priority for dragged milestone
    const dotRadius = 10; // radius of milestone dots
    const stackOffset = 30; // pixels to stack overlapping milestones vertically
    const finalPositions = [];

    // First: Position the currently dragged milestone OR recently dragged milestone on the hill curve
    let priorityMilestone = null;
    if (this.draggedMilestone) {
      priorityMilestone = sortedMilestones.find(m => m.id === this.draggedMilestone.id);
    } else {
      // Find the most recently dragged milestone by drag order
      const recentlyDragged = sortedMilestones.filter(m => m.dragOrder);
      if (recentlyDragged.length > 0) {
        priorityMilestone = recentlyDragged.sort((a, b) => b.dragOrder - a.dragOrder)[0];
      }
    }
    
    if (priorityMilestone) {
      finalPositions.push({ 
        milestone: priorityMilestone, 
        x: priorityMilestone.x, 
        y: this.getHillY(priorityMilestone.x) 
      });
    }

    // Second: Position all other milestones, stacking them if they overlap
    sortedMilestones.forEach((milestone) => {
      const isPriorityMilestone = priorityMilestone && priorityMilestone.id === milestone.id;
      
      if (!isPriorityMilestone) {
        let adjustedX = milestone.x;
        let adjustedY = this.getHillY(adjustedX);
        
        // Check if this milestone would visually overlap with any already positioned milestone
        let stackLevel = 0;
        for (const pos of finalPositions) {
          const horizontalDistance = Math.abs(adjustedX - pos.x);
          const verticalDistance = Math.abs(adjustedY - pos.y);
          
          // Check if dots are close enough horizontally to consider stacking
          const horizontalThreshold = dotRadius * 3; // Allow some horizontal proximity
          
          // If horizontally close, then check vertical overlap
          // Allow 25% vertical overlap before stacking
          const allowedVerticalOverlap = dotRadius * 2 * 0.75; // 75% of full diameter = 25% overlap allowed
          const wouldOverlap = horizontalDistance < horizontalThreshold && verticalDistance < allowedVerticalOverlap;
          
          if (wouldOverlap) {
            stackLevel++;
            adjustedY = this.getHillY(adjustedX) - stackLevel * stackOffset;
          }
        }
        
        finalPositions.push({ milestone, x: adjustedX, y: adjustedY });
      }
    });

    // Render all milestones using their final positions
    finalPositions.forEach((pos) => {
      const milestone = pos.milestone;
      const adjustedX = pos.x;
      const adjustedY = pos.y;

      const milestoneGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      milestoneGroup.classList.add("milestone-point");
      milestoneGroup.setAttribute("data-milestone-id", milestone.id);

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", adjustedX);
      circle.setAttribute("cy", adjustedY);
      circle.setAttribute("r", 10);

      // Create text with wrapping support
      const textGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );

      // Position text on left side if milestone is on left side of hill
      const hillCenter = (this.hillStartX + this.hillEndX) / 2;
      const isLeftSide = adjustedX < hillCenter;
      const textOffset = 80;
      const textX = isLeftSide ? adjustedX - textOffset : adjustedX + textOffset;
      const textAnchor = isLeftSide ? "end" : "start";

      this.createWrappedText(
        textGroup,
        milestone.name,
        textX,
        adjustedY,
        textAnchor,
        isLeftSide
      );

      milestoneGroup.appendChild(circle);
      milestoneGroup.appendChild(textGroup);
      milestonePoints.appendChild(milestoneGroup);

      this.bindMilestoneEvents(milestoneGroup, milestone, adjustedY);
    });
  }

  createWrappedText(textGroup, text, x, y, textAnchor, isLeftSide) {
    const maxWidth = 150; // Maximum width for text before wrapping
    const lineHeight = 14; // Height between lines
    const words = text.split(" ");

    let lines = [];
    let currentLine = "";

    // Simple word wrapping
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      // Estimate if line would be too long (rough approximation)
      if (testLine.length * 7 > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);


    // Create SVG text elements for each line
    lines.forEach((line, index) => {
      const textElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      textElement.setAttribute("x", x);
      textElement.setAttribute(
        "y",
        y + index * lineHeight - ((lines.length - 1) * lineHeight) / 2
      );
      textElement.setAttribute("text-anchor", textAnchor);
      textElement.setAttribute("class", "milestone-text");
      textElement.textContent = line;
      textGroup.appendChild(textElement);
    });
  }

  bindMilestoneEvents(milestoneGroup, milestone, adjustedY) {
    let isDragging = false;

    milestoneGroup.addEventListener("mousedown", (e) => {
      isDragging = true;
      this.draggedMilestone = milestone;
      milestoneGroup.classList.add("dragging");
      e.preventDefault();
    });

    this.svg.addEventListener("mousemove", (e) => {
      if (!isDragging || this.draggedMilestone !== milestone) return;

      const rect = this.svg.getBoundingClientRect();
      const x = e.clientX - rect.left;

      // Clamp x to hill bounds but continue dragging
      let clampedX = Math.max(this.hillStartX, Math.min(this.hillEndX, x));
      
      // Snap to key positions if close enough
      const snapThreshold = 30; // pixels
      const snapPoints = [
        this.hillStartX,     // Start (0%)
        (this.hillStartX + this.hillEndX) / 2,  // Peak (50%) 
        this.hillEndX        // End (100%)
      ];
      
      for (const snapPoint of snapPoints) {
        if (Math.abs(clampedX - snapPoint) < snapThreshold) {
          clampedX = snapPoint;
          break;
        }
      }
      
      milestone.x = clampedX;
      milestone.progress =
        (clampedX - this.hillStartX) / (this.hillEndX - this.hillStartX);
      
      // The dragged milestone always stays on the hill curve
      let newY = this.getHillY(clampedX);
      
      // Force re-render to handle stacking of other milestones
      this.render();
    });

    document.addEventListener("mouseup", () => {
      if (isDragging && this.draggedMilestone === milestone) {
        isDragging = false;
        this.draggedMilestone = null;
        milestoneGroup.classList.remove("dragging");
        
        // Give the just-dragged milestone priority by updating its drag order
        this.dragOrder++;
        milestone.dragOrder = this.dragOrder;
        
        // Full render when drag is complete to handle stacking
        this.render();
        this.saveMilestones();
      }
    });
  }

  renderMilestoneList() {
    this.milestoneList.innerHTML = "";

    const activeMilestones = this.milestones;

    activeMilestones.forEach((milestone) => {
      const li = document.createElement("li");
      li.classList.add("milestone-item");

      const progress = Math.round(milestone.progress * 100);
      const phase =
        milestone.progress < 0.5 ? "Problem Analysis" : "Executing Plan";

      li.innerHTML = `
                <div>
                    <span class="milestone-name">${milestone.name}</span>
                    <span class="milestone-position">${progress}% - ${phase}</span>
                </div>
                <button class="remove-btn" onclick="hillChart.removeMilestone(${milestone.id})">×</button>
            `;

      this.milestoneList.appendChild(li);
    });
  }


  downloadImage() {
    const chartContainer = document.querySelector('.hill-chart-container');
    
    html2canvas(chartContainer, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      logging: false
    }).then(canvas => {
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hill-chart-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    }).catch(error => {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    });
  }

  downloadSVG() {
    // Fallback: download the raw SVG file
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hill-chart-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }


  updateTitle(title) {
    this.chartTitle.textContent = title || "Chart Title";
    this.saveTitle(title);
  }

  saveTitle(title) {
    localStorage.setItem("hillChartTitle", title);
  }

  loadTitle() {
    const saved = localStorage.getItem("hillChartTitle");
    if (saved) {
      this.titleInput.value = saved;
      this.chartTitle.textContent = saved;
    }
  }

  clearAll() {
    if (
      confirm(
        "Comrade! Are you sure you want to clear all five-year plan production goals?"
      )
    ) {
      this.milestones = [];
      this.render();
      this.saveMilestones();
    }
  }

  saveMilestones() {
    localStorage.setItem(
      "hillChartMilestones",
      JSON.stringify(this.milestones)
    );
  }

  updateCenterLine() {
    const centerLineGroup = this.svg.querySelector('.center-line');
    centerLineGroup.innerHTML = '';
    
    const hillCenter = (this.hillStartX + this.hillEndX) / 2; // x=600
    const gapSize = 20; // pixels gap around milestones
    const lineStart = 50;
    const lineEnd = 480;
    
    // Find all gaps where milestones are near the center line
    // Need to use the same positioning logic as renderMilestonePoints
    const gaps = [];
    const activeMilestones = this.milestones;
    const sortedMilestones = [...activeMilestones].sort((a, b) => a.x - b.x);
    const dotRadius = 10;
    const stackOffset = 30;
    const finalPositions = [];

    // Recreate the positioning logic to get actual milestone positions
    let priorityMilestone = null;
    if (this.draggedMilestone) {
      priorityMilestone = sortedMilestones.find(m => m.id === this.draggedMilestone.id);
    } else {
      const recentlyDragged = sortedMilestones.filter(m => m.dragOrder);
      if (recentlyDragged.length > 0) {
        priorityMilestone = recentlyDragged.sort((a, b) => b.dragOrder - a.dragOrder)[0];
      }
    }
    
    if (priorityMilestone) {
      finalPositions.push({ 
        milestone: priorityMilestone, 
        x: priorityMilestone.x, 
        y: this.getHillY(priorityMilestone.x) 
      });
    }

    sortedMilestones.forEach((milestone) => {
      const isPriorityMilestone = priorityMilestone && priorityMilestone.id === milestone.id;
      
      if (!isPriorityMilestone) {
        let adjustedX = milestone.x;
        let adjustedY = this.getHillY(adjustedX);
        
        let stackLevel = 0;
        for (const pos of finalPositions) {
          const horizontalDistance = Math.abs(adjustedX - pos.x);
          const verticalDistance = Math.abs(adjustedY - pos.y);
          const horizontalThreshold = dotRadius * 3;
          const allowedVerticalOverlap = dotRadius * 2 * 0.75;
          const wouldOverlap = horizontalDistance < horizontalThreshold && verticalDistance < allowedVerticalOverlap;
          
          if (wouldOverlap) {
            stackLevel++;
            adjustedY = this.getHillY(adjustedX) - stackLevel * stackOffset;
          }
        }
        
        finalPositions.push({ milestone, x: adjustedX, y: adjustedY });
      }
    });

    // Now check actual final positions for gaps
    finalPositions.forEach(pos => {
      if (Math.abs(pos.x - hillCenter) < gapSize) {
        gaps.push({
          start: pos.y - gapSize,
          end: pos.y + gapSize
        });
      }
    });
    
    // Merge overlapping gaps
    gaps.sort((a, b) => a.start - b.start);
    const mergedGaps = [];
    for (const gap of gaps) {
      if (mergedGaps.length === 0 || gap.start > mergedGaps[mergedGaps.length - 1].end) {
        mergedGaps.push(gap);
      } else {
        mergedGaps[mergedGaps.length - 1].end = Math.max(mergedGaps[mergedGaps.length - 1].end, gap.end);
      }
    }
    
    // Draw line segments between gaps
    let currentY = lineStart;
    for (const gap of mergedGaps) {
      if (currentY < gap.start) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', hillCenter);
        line.setAttribute('y1', currentY);
        line.setAttribute('x2', hillCenter);
        line.setAttribute('y2', gap.start);
        line.setAttribute('class', 'center-guide-line');
        centerLineGroup.appendChild(line);
      }
      currentY = gap.end;
    }
    
    // Draw final segment if needed
    if (currentY < lineEnd) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', hillCenter);
      line.setAttribute('y1', currentY);
      line.setAttribute('x2', hillCenter);
      line.setAttribute('y2', lineEnd);
      line.setAttribute('class', 'center-guide-line');
      centerLineGroup.appendChild(line);
    }
  }

  loadMilestones() {
    const saved = localStorage.getItem("hillChartMilestones");
    if (saved) {
      this.milestones = JSON.parse(saved);
      this.render();
    }
  }
}

const hillChart = new HillChartGenerator();
