/**
 * Check if element is node
 * @param {*} object
 * @returns boolean
 */
const isNode = (object) => {
  return Boolean(
    object &&
      typeof object.nodeName === "string" &&
      typeof object.nodeType === "number" &&
      object.childNodes &&
      typeof object.appendChild === "function"
  );
};

/**
 * Creates HTML element in editor document
 *
 * @param {string} name
 * @param {Object.<string, string>} [attributes = {}]
 * @param {string} [html = '']
 * @return {HTMLElement}
 */
const createElement = (name, { attributes = {}, html = "" } = {}) => {
  const element = document.createElement(name);
  element.innerHTML = html;
  Object.entries(attributes).forEach(
    ([key, val]) => val && element.setAttribute(key, `${val}`)
  );
  return element;
};

/**
 * Wraps element with given parent
 *
 * @param {HTMLElement} element
 * @param {string} tag
 * @param {Object} [options = {}]
 * @return {void}
 */
const wrapElement = (element, tag, options) => {
  const wrapper = isNode(tag) ? tag : createElement(tag, options);
  if (isNode(element)) {
    if (!element.parentNode) {
      throw new Error("Element should be in DOM");
    }
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
  } else {
    const fragment = element.extractContents();
    element.insertNode(wrapper);
    wrapper.appendChild(fragment);
  }
};

/**
 * getElementOffset
 * @param {*} element
 */
const getElementOffset = (element) => {
  const offset = { x: 0, y: 0, width: 0, height: 0 };

  if (element instanceof HTMLElement) {
    offset.width = element.offsetWidth;
    offset.height = element.offsetHeight;

    do {
      offset.x += element.offsetLeft;
      offset.y += element.offsetTop;
    } while ((element = element.offsetParent));

    return offset;
  } else {
    throw new Error("");
  }
};

/**
 * Table row col edit
 */
class TableRowCol {
  constructor(table, options) {
    this.table = table instanceof HTMLTableElement
      ? table
      : document.createElement("table");
    this.options = options instanceof Object ? options : {};

    this.rowIndex = [];
    this.colIndex = [];

    // Wrap the table with new elements
    wrapElement(this.table, "div", {
      attributes: { class: "table-editor-wrap" },
    });

    ["thead", "tbody", "tfoot", "summary"].forEach((tag) => {
      this[tag] = this.table.getElementsByTagName(tag).length
        ? this.table.getElementsByTagName(tag)[0]
        : document.createElement(tag);
    });

    // Assign some basic classes
    this.table.className += " table-controller-active";

    // render controller
    this.renderController();

    // Now build an internal representation of our rows and columns
    this.updateRender();
  }

  /**
   * Update
   * @returns
   */
  updateRender() {
    this.updateTableSection();
    this.updateCellIndex();
    this.updateCellState();
    this.updateController();
    this.emit("updateRender");
  }

  /**
   * Update section elements
   * @returns
   */
  updateTableSection() {
    ["summary", "thead", "tbody", "tfoot"]
      .map((item) => {
        if (this[item].parentNode) {
          this.table.removeChild(this[item]);
        }
        return item;
      })
      .forEach((key) => {
        const cells = [].slice.call(this[key].childNodes, 0).filter((node) => {
          return node.nodeType === 1;
        });

        if (cells.length) {
          this.table.appendChild(this[key]);
        }
      });
  }

  /**
   * Update index
   * @returns
   */
  updateCellIndex() {
    // First, get an idea of how many rows we're dealing with.
    this.rowIndex = [].slice.call(this.table.getElementsByTagName("tr"), 0);

    // Clear colindex
    this.colIndex = [];

    // Now loop through each row and generate column indexes.
    this.rowIndex.forEach((row, rIndex) => {
      // Save our row index!
      row.index = rIndex;

      // First, get a sanitised list of cells.
      // Try not to rely on QSA - ES5 array methods can be polyfilled more easily than QSA can.
      const cells = [].slice.call(row.childNodes, 0).filter((node) => {
        return node.nodeType === 1 && node instanceof HTMLTableCellElement;
      });

      // Now loop through each cell
      cells.forEach((cell, cIndex) => {
        cell.index = cIndex;
        if (cIndex > this.colIndex.length - 1) {
          return this.colIndex.push([cell]);
        }
        this.colIndex[cIndex].push(cell);
      });
    });
  }

  /**
   * Update cell states
   * @returns
   */
  updateCellState() {
    this.colIndex.forEach((col) => {
      col.forEach((cell) => {
        cell.setAttribute("contenteditable", "true");
      });
    });
  }

  /**
   * Render controller
   */
  renderController() {
    const tableParent = this.table.parentElement || document.body;

    // row controller
    this.rowController = document.createElement("div");
    this.rowController.appendChild(document.createElement("ul"));
    this.rowController.className = "table-controller controller-row";
    this.rowController.style.position = "absolute";

    // col controller
    this.colController = document.createElement("div");
    this.colController.appendChild(document.createElement("ul"));
    this.colController.className = "table-controller controller-col";
    this.colController.style.position = "absolute";

    // obscurer and menu
    this.controllerMenuObscurer = document.createElement("div");
    this.controllerMenuObscurer.className = "table-controller-obscurer";
    this.controllerMenuElement = document.createElement("ul");
    this.controllerMenuElement.className = "table-controller-menu";

    // And to any document or interaction events we might need to keep our UI looking nice...
    window.addEventListener("resize", this.updateControllerPosition.bind(this));
    document.addEventListener(
      "scroll",
      this.updateControllerPosition.bind(this)
    );
    this.table.addEventListener(
      "keydown",
      this.updateControllerPosition.bind(this)
    );
    this.table.addEventListener(
      "keyup",
      this.updateControllerPosition.bind(this)
    );

    // And now set some events for our obscure-layer
    const removeControllerMenu = () => {
      tableParent.removeChild(this.controllerMenuObscurer);
      tableParent.removeChild(this.controllerMenuElement);
    };

    this.controllerMenuObscurer.addEventListener("click", removeControllerMenu);
    this.controllerMenuObscurer.addEventListener(
      "touchstart",
      removeControllerMenu
    );

    tableParent.appendChild(this.rowController);
    tableParent.appendChild(this.colController);
  }

  /**
   * Update controller
   */
  updateController() {
    this.rowController.firstElementChild.innerHTML = "";
    this.colController.firstElementChild.innerHTML = "";

    // Generate list items for rows and cols.
    this.rowIndex.forEach((row, index) => {
      const rowItem = document.createElement("li");
      const rowItemLabel = document.createElement("label");

      rowItemLabel.innerHTML = index + 1;
      rowItem.appendChild(rowItemLabel);
      this.rowController.firstElementChild.appendChild(rowItem);

      rowItem.addEventListener("click", () => {
        this.showControllerMenu("row", rowItem, row);
      });
    });

    this.colIndex.forEach((col, index) => {
      let unitAlpha = index % 26;
      let globalAlpha = (index / 26) | 0;
      let alphaString = String.fromCharCode(unitAlpha + 65);

      if (globalAlpha > 0) {
        alphaString = String.fromCharCode(globalAlpha + 64) + alphaString;
      }

      const colItem = document.createElement("li");
      const colItemLabel = document.createElement("label");
      colItemLabel.innerHTML = alphaString;

      colItem.appendChild(colItemLabel);
      this.colController.firstElementChild.appendChild(colItem);

      colItem.addEventListener("click", () => {
        this.showControllerMenu("col", colItem, col);
      });
    });

    this.updateControllerPosition();
  }

  /**
   * Update controller position
   * @returns
   */
  updateControllerPosition() {
    // The UI centers around the table. So get the table offset...
    const tableOffset = getElementOffset(this.table);

    let scrollTop = document.body.scrollTop >= 0 ? document.body.scrollTop : 0,
      scrollLeft = document.body.scrollLeft >= 0 ? document.body.scrollLeft : 0,
      wheight = window.innerHeight,
      wwidth = window.innerWidth,
      top = tableOffset.y - scrollTop,
      left = tableOffset.x - scrollLeft,
      height = tableOffset.height,
      width = tableOffset.width,
      viewportBase = scrollTop + wheight,
      viewportRight = scrollLeft + wwidth,
      tableBase = tableOffset.height + tableOffset.y,
      tableRight = tableOffset.width + tableOffset.x;

    // Check to ensure our values are in bounds...
    scrollTop =
      scrollTop + wheight > document.body.scrollHeight
        ? document.body.scrollHeight - wheight
        : scrollTop;

    scrollLeft =
      scrollLeft + wwidth > document.body.scrollWidth
        ? document.body.scrollLeft - wwidth
        : scrollLeft;

    const rowCrtlScrollTop = top - 40 <= 0 ? (top - 40) * -1 : 0;
    const colCtrlScrollLeft = left - 40 <= 0 ? (left - 40) * -1 : 0;

    // And compute the final dimensions...
    top = top <= 40 ? 40 : top;
    left = left <= 40 ? 40 : left;
    height = top + height > wheight - 3 ? wheight - top - 3 : height;
    width = left + width > wwidth - 3 ? wwidth - left - 3 : width;
    height =
      tableBase - scrollTop - top < height
        ? tableBase - scrollTop - top
        : height;
    width =
      tableRight - scrollLeft - left < width
        ? tableRight - scrollLeft - left
        : width;

    this.rowController.style.height = height + "px";
    this.rowController.style.top = top + "px";
    this.rowController.style.left = left + "px";
    this.rowController.scrollTop = rowCrtlScrollTop;

    this.colController.style.width = width + "px";
    this.colController.style.top = top + "px";
    this.colController.style.left = left + "px";
    this.colController.scrollLeft = colCtrlScrollLeft;

    // Set the dimensions of children in the row and col controller
    const rowControllerChilds = this.rowController.firstElementChild.childNodes;
    [].slice.call(rowControllerChilds).forEach((node, index) => {
      if (this.rowIndex[index]) {
        const rowDimensions = getElementOffset(this.rowIndex[index]);
        node.style.height = rowDimensions.height + "px";
      }
    });

    const colControllerChilds = this.colController.firstElementChild.childNodes;
    [].slice.call(colControllerChilds).forEach((node, index) => {
      if (this.colIndex[index]) {
        const col = this.colIndex[index][0];
        const colDimensions = getElementOffset(col);
        node.style.width = colDimensions.width + "px";
      }
    });
  }

  /**
   * show menu
   * @param {*} orientation
   * @param {*} tab
   * @param {*} object
   * @returns
   */
  showControllerMenu(orientation, tab, object) {
    const tableParent = this.table.parentElement || document.body;
    let objectName = orientation === "row" ? "Row" : "Column";
    let index = object.index !== undefined ? object.index : object[0].index;

    const menuItem = (text, handler) => {
      const menuItemLi = document.createElement("li");
      menuItemLi.innerHTML = text;

      const handleMenu = () => {
        tableParent.removeChild(this.controllerMenuObscurer);
        tableParent.removeChild(this.controllerMenuElement);
        handler();
      };

      menuItemLi.addEventListener("click", handleMenu);
      menuItemLi.addEventListener("touchstart", handleMenu);
      return menuItemLi;
    };
    
    this.controllerMenuElement.innerHTML = "";
    tableParent.appendChild(this.controllerMenuObscurer);
    tableParent.appendChild(this.controllerMenuElement);

    let tabPosition = getElementOffset(tab);
    let menuX = tabPosition.x + (orientation === "row" ? tabPosition.width : 0);
    let menuY =
      tabPosition.y + (orientation !== "row" ? tabPosition.height : 0);

    this.controllerMenuElement.appendChild(
      menuItem("Delete " + objectName, () => {
        this["remove" + objectName](index);
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Insert Header " + objectName + " Before", () => {
        this["add" + objectName]("header", index);
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Insert Header " + objectName + " After", () => {
        this["add" + objectName]("header", index + 1);
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Insert " + objectName + " Before", () => {
        this["add" + objectName]("normal", index);
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Insert " + objectName + " After", () => {
        this["add" + objectName]("normal", index + 1);
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Convert to header " + objectName.toLowerCase(), () => {
        this["change" + objectName + "Type"](index, "header");
      })
    );

    this.controllerMenuElement.appendChild(
      menuItem("Convert to regular " + objectName.toLowerCase(), () => {
        this["change" + objectName + "Type"](index, "normal");
      })
    );

    this.controllerMenuElement.style.left = menuX + "px";
    this.controllerMenuElement.style.top = menuY + "px";
  }

  /**
   * Add row
   * @param {*} kind
   * @param {*} position
   * @returns
   */
  addRow(kind, position) {
    if (position === null || position === undefined) {
      position = this.rowIndex.length;
    }

    // Ensure the position we've got is reasonable and not way out of bounds.
    if (position > this.rowIndex.length) {
      position = this.rowIndex.length;
    }

    if (position < 0) {
      position = 0;
    }

    // Create our new row
    const newRow = document.createElement("tr");

    // Populate with new cells
    while (newRow.childNodes.length < this.colIndex.length) {
      const cell = document.createElement(
        kind === "header" || kind === "footer" ? "th" : "td"
      );
      cell.innerHTML = "&nbsp;";
      newRow.appendChild(cell);
    }

    // Get previous and next rows
    const prevRow = position > 0 ? this.rowIndex[position - 1] : null;
    const nextRow = this.rowIndex[position];

    // General rule: inherit table section downward through the table, from
    // the previous row.

    // If new row is before any element in thead, we're in thead
    if (nextRow && nextRow.parentNode === this.thead) {
      this.thead.insertBefore(newRow, nextRow);

      // If the new row is a header directly after an element in thead we're in thead
    } else if (
      nextRow &&
      prevRow.parentNode === this.thead &&
      kind === "header"
    ) {
      this.thead.appendChild(newRow);

      // If the new row is after any element in tfoot, we're in tfoot.
    } else if (prevRow && prevRow.parentNode === this.tfoot) {
      if (nextRow) {
        this.tfoot.insertBefore(newRow, nextRow);
      } else {
        this.tfoot.appendChild(newRow);
      }

      // If the new row is a header directly before an element in tfoot we're in tfoot
    } else if (
      nextRow &&
      nextRow.parentNode === this.tfoot &&
      kind === "header"
    ) {
      this.tfoot.insertBefore(newRow, nextRow);

      // Or, if we're the first row and type header, we're in thead
    } else if (position === 0 && kind === "header") {
      if (nextRow) {
        this.thead.insertBefore(newRow, nextRow);
      } else {
        this.thead.appendChild(newRow);
      }

      // Or, if we're the last row and type header, we're in tfoot
    } else if (position === this.rowIndex.length && kind === "header") {
      this.tfoot.appendChild(newRow);

      // And if nothing else matches, we must be in tbody.
      // Add new row in a sensible location!
    } else {
      if (nextRow && nextRow.parentNode === this.tbody) {
        this.tbody.insertBefore(newRow, nextRow);
      } else {
        this.tbody.appendChild(newRow);
      }
    }

    // Update table information!
    this.updateRender();
  }

  /**
   * Remove row
   * @param {*} rowIdentifier
   */
  removeRow(rowIdentifier) {
    // Map back from an HTML element to a row index if that's what we
    // were supplied!
    if (rowIdentifier instanceof HTMLElement) {
      rowIdentifier = rowIdentifier.index;
    }

    if (this.rowIndex[rowIdentifier]) {
      this.rowIndex[rowIdentifier].parentNode.removeChild(
        this.rowIndex[rowIdentifier]
      );
    } else {
      throw new Error("Row could not be located in index!");
    }

    // Update the internal representation of the table.
    this.updateRender();
  }

  /**
   * Add column
   * @param {*} kind
   * @param {*} position
   */
  addColumn(kind, position) {
    // const this = this;
    if (position === null || position === undefined) {
      position = this.colIndex.length;
    }

    // Ensure the position we've got is reasonable and not way
    // out of bounds.
    if (position > this.colIndex.length) {
      position = this.colIndex.length;
    }

    if (position < 0) position = 0;

    // Loop through all rows, appending column at current position.
    this.rowIndex.forEach((row) => {
      let rowKind = kind;

      if (row.parentNode === this.thead || row.parentNode === this.tfoot) {
        rowKind = "header";
      }

      const newCell = document.createElement(
        rowKind === "header" || rowKind === "footer" ? "th" : "td"
      );

      newCell.innerHTML = "&nbsp;";

      if (position === this.colIndex.length) {
        row.appendChild(newCell);
      } else {
        const cells = [].slice.call(row.childNodes, 0).filter((node) => {
          return node.nodeType === 1 && node instanceof HTMLTableCellElement;
        });
        row.insertBefore(newCell, cells[position]);
      }
    });

    this.updateRender();
  }

  /**
   * Remove column
   * @param {*} colIdentifier
   */
  removeColumn(colIdentifier) {
    // Map back from an HTML element to a col index if that's what we
    // were supplied!
    if (colIdentifier instanceof HTMLElement) {
      colIdentifier = colIdentifier.index;
    }

    if (this.colIndex[colIdentifier]) {
      this.colIndex[colIdentifier].forEach((cell) => {
        const row = cell.parentNode;
        const cells = [].slice.call(row.childNodes, 0).filter((node) => {
          return node.nodeType === 1 && node instanceof HTMLTableCellElement;
        });

        row.removeChild(cell);

        // If there's nothing left in this row...
        if (!cells.length) {
          row.parentNode.removeChild(cell);
        }
      });
    } else {
      throw new Error("Row could not be located in index!");
    }

    // Update the internal representation of the table.
    this.updateRender();
  }

  /**
   * Change cell type
   * @param {*} x
   * @param {*} y
   * @param {*} newType
   * @param {*} bulk
   */
  changeCellType(x, y, newType, bulk) {
    if (this.colIndex[x]) {
      if (this.colIndex[x][y]) {
        // Get cell and normalise types for easy comparison
        const cell = this.colIndex[x][y];
        const oldType = cell.tagName === "TH" ? "th" : "td";
        newType = newType === "header" || newType === "footer" ? "th" : "td";

        if (oldType !== newType) {
          const cellText = cell.innerText;
          const newCell = document.createElement(newType);

          newCell.innerText = cellText;

          // Now replace the old cell with the new one
          cell.parentNode.replaceChild(newCell, cell);
        }
      } else {
        throw new Error("Requested cell Y value out of bounds.");
      }
    } else {
      throw new Error("Requested cell X value out of bounds.");
    }

    if (!bulk) {
      this.updateRender();
    }
  }

  /**
   * Change row type
   * @param {*} y
   * @param {*} newType
   */
  changeRowType(y, newType) {
    if (this.rowIndex[y]) {
      for (let x = 0; x < this.colIndex.length; x++) {
        this.changeCellType(x, y, newType, true);
      }
      this.updateRender();
    } else {
      throw new Error("Requested row index out of bounds.");
    }
  }

  /**
   * Change column type
   * @param {*} x
   * @param {*} newType
   */
  changeColumnType(x, newType) {
    if (this.colIndex[x]) {
      this.colIndex[x].forEach((cell, y) => {
        this.changeCellType(x, y, newType, true);
      });
      this.updateRender();
    } else {
      throw new Error("Requested column index out of bounds.");
    }
  }

  /**
   * Alter cell
   * @param {*} x
   * @param {*} y
   * @param {*} cellText
   */
  alterCell(x, y, cellText) {
    if (this.colIndex[x]) {
      if (this.rowIndex[y]) {
        const cell = this.colIndex[x][y];
        cell.innerText = cellText;
      } else {
        throw new Error("Requested row index out of bounds.");
      }
    } else {
      throw new Error("Requested column index out of bounds.");
    }

    this.updateRender();
  }

  /**
   * Summary
   * @param {*} value
   */
  summary(value) {
    if (!!value) {
      this.summary.innerText = value;
      this.updateRender();
    } else {
      return this.summary.innerText;
    }
  }

  /**
   * On
   * Function for binding a handler to a TableEdit event.
   * @param {String} eventName name of event to bind handler to.
   * @param {Function} handler which is bound to the event.
   * Examples:
			myTable.on("updateRender", function(column) {
				console.log("A new column! I see it!");
			});
   */
  on(eventName, handler) {
    // We must have a valid name
    if (
      !eventName ||
      typeof eventName !== "string" ||
      eventName.match(/[^a-z0-9\.\*\-]/gi)
    ) {
      throw new Error("Attempt to subscribe to event with invalid name!");
    }

    // We've gotta have a valid function
    if (!handler || !(handler instanceof Function)) {
      throw new Error("Attempt to subscribe to event without a handler!");
    }

    // Create handler object if it doesn't exist
    if (!this.eventHandlers || !(this.eventHandlers instanceof Object)) {
      this.eventHandlers = {};
    }

    if (
      this.eventHandlers[eventName] &&
      this.eventHandlers[eventName] instanceof Array
    ) {
      this.eventHandlers[eventName].push(handler);
    } else {
      this.eventHandlers[eventName] = [handler];
    }
  }

  /**
   * Emit
   * Called by TableEdit internally when emitting an event. This function is responsible for calling all the event handlers in turn.
   * @param {*} eventName used to determine which event is being emitted.
   * Examples: this.emit("pause");
   */
  emit(eventName) {
    const args = arguments;

    // If we've lost our handler object, or have no handlers, just return.
    if (!this.eventHandlers) {
      return;
    }

    // Ensure we've got handlers in the format we expect...
    if (
      !this.eventHandlers[eventName] ||
      !(this.eventHandlers[eventName] instanceof Array)
    ) {
      return;
    }

    // OK, so we have handlers for this event.
    this.eventHandlers[eventName]
      // We need these to be functions!
      .filter((iHandler) => {
        return iHandler instanceof Function;
      })
      .forEach((oHandler) => {
        // Execute each handler in the context of the Vixen object,
        // and with the arguments we were passed (less the event name)
        oHandler.apply(this, [].slice.call(args, 1));
      });
  }
}
