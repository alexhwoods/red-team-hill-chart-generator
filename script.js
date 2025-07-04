class HillChartGenerator {
  constructor() {
    this.svg = document.getElementById("hillChart");
    this.milestoneInput = document.getElementById("milestoneInput");
    this.addMilestoneBtn = document.getElementById("addMilestone");
    this.exportBtn = document.getElementById("exportBtn");
    this.clearBtn = document.getElementById("clearBtn");
    this.milestoneList = document.getElementById("milestoneList");

    this.milestones = [];
    this.draggedMilestone = null;
    this.chartWidth = 1000;
    this.chartHeight = 400;
    this.hillStartX = 200;
    this.hillEndX = 800;
    this.hillTopY = 80;
    this.hillBottomY = 280;

    this.init();
  }

  init() {
    this.drawHillCurve();
    this.bindEvents();
    this.loadMilestones();
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

    // Build SVG path using the sampled points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  }

  bindEvents() {
    this.addMilestoneBtn.addEventListener("click", () => this.addMilestone());
    this.milestoneInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addMilestone();
    });
    this.exportBtn.addEventListener("click", () => this.exportData());
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
    // Center the curve at x = 0.5, with standard deviation that fits well
    const mean = 0.5;
    const stdDev = 0.2;
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
  }

  renderMilestonePoints() {
    const milestonePoints = this.svg.querySelector(".milestone-points");
    milestonePoints.innerHTML = "";

    const activeMilestones = this.milestones;
    
    // Sort milestones by x position for consistent stacking
    const sortedMilestones = [...activeMilestones].sort((a, b) => a.x - b.x);

    // Track positions to handle overlapping
    const usedPositions = [];

    sortedMilestones.forEach((milestone) => {
      // Handle overlapping by stacking vertically
      let adjustedX = milestone.x;
      let adjustedY = this.getHillY(adjustedX);
      const overlapThreshold = 35; // pixels
      const stackOffset = 40; // pixels to stack overlapping milestones vertically

      // Find if there's an overlapping position and stack vertically
      let stackLevel = 0;
      for (const usedPos of usedPositions) {
        if (Math.abs(adjustedX - usedPos.x) < overlapThreshold) {
          stackLevel++;
          // Stack vertically above the hill curve
          adjustedY = this.getHillY(adjustedX) - stackLevel * stackOffset;
        }
      }

      // Store this position
      usedPositions.push({ x: adjustedX, y: adjustedY });

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
      circle.setAttribute("r", 15);

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

      if (x >= this.hillStartX && x <= this.hillEndX) {
        milestone.x = x;
        milestone.progress =
          (x - this.hillStartX) / (this.hillEndX - this.hillStartX);
        
        // Check for overlapping milestones and calculate stacking position
        const overlapThreshold = 35;
        const stackOffset = 40;
        let stackLevel = 0;
        let newY = this.getHillY(x);
        
        // Check overlap with other milestones
        for (const otherMilestone of this.milestones) {
          if (otherMilestone.id !== milestone.id && 
              Math.abs(x - otherMilestone.x) < overlapThreshold) {
            stackLevel++;
            newY = this.getHillY(x) - stackLevel * stackOffset;
          }
        }
        
        // Update circle position
        const circle = milestoneGroup.querySelector("circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", newY);
        
        // Update text position based on which side of hill
        const hillCenter = (this.hillStartX + this.hillEndX) / 2;
        const isLeftSide = x < hillCenter;
        const textOffset = 80;
        const textX = isLeftSide ? x - textOffset : x + textOffset;
        const textAnchor = isLeftSide ? "end" : "start";
        
        const textGroup = milestoneGroup.querySelector("g");
        const textElements = textGroup.querySelectorAll("text");
        textElements.forEach((textElement, index) => {
          textElement.setAttribute("x", textX);
          textElement.setAttribute("text-anchor", textAnchor);
          const lineHeight = 14;
          const totalLines = textElements.length;
          const yOffset = index * lineHeight - ((totalLines - 1) * lineHeight) / 2;
          textElement.setAttribute("y", newY + yOffset);
        });
      }
    });

    document.addEventListener("mouseup", () => {
      if (isDragging && this.draggedMilestone === milestone) {
        isDragging = false;
        this.draggedMilestone = null;
        milestoneGroup.classList.remove("dragging");
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


  exportData() {
    const data = {
      milestones: this.milestones.map((milestone) => ({
        name: milestone.name,
        progress: Math.round(milestone.progress * 100),
        phase: milestone.progress < 0.5 ? "Problem Analysis" : "Executing Plan",
      })),
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hill-chart-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  loadMilestones() {
    const saved = localStorage.getItem("hillChartMilestones");
    if (saved) {
      this.milestones = JSON.parse(saved);
      this.render();
    }
  }
}

const hillChart = new HillChartGenerator();
