/**
 * Table merge or split
 */
class TableMergeSplit {
  constructor(table) {
    this.table = table;
    this.startTD = null;
    this.endTD = null;
    this.MMRC = {
      startRowIndex: -1,
      startCellIndex: -1,
      endRowIndex: -1,
      endCellIndex: -1,
    };
    this.rcMaps = {};
    this.totalCell = 0;

    this.updateTdRc(table);

    document.addEventListener("mousedown", (e) => {
      console.log(e);
    });
  }

  /**
   * 初始表格的原始rowIndex，cellIndex及跨行，跨列信息
   */
  updateTdRc() {
    this.table.addEventListener("mousedown", this.onMousedown.bind(this));
    this.table.classList.add("cannotselect");

    // 用第一行计算总的td数量，其他行计算不准确
    let firstRow = this.table.rows[0];
    this.totalCell = 0;
    for (let td of firstRow.cells) {
      this.totalCell += td.colSpan;
    }
    for (let i = 0; i < this.table.rows.length; i++) {
      for (let j = 0; j < this.table.rows[i].cells.length; j++) {
        if(!this.table.rows[i].cells[j].hasAttribute("id")) {
          this.table.rows[i].cells[j].setAttribute("id", `cell_${i}_${j}`);
        }
        const curtCell = this.table.rows[i].cells[j];
        const curtCellId = curtCell.getAttribute("id");
        const rcData = this.getRC(curtCell, this.totalCell);
        this.rcMaps[curtCellId] = JSON.parse(rcData);
      }
    }
    console.log("rcMaps: ", this.rcMaps);
  }

  /**
   * 获取单元格原始rowIndex和cellIndex
   * @param {HTMLTableCellElement} curTd
   * @param {int} total
   * @returns
   */
  getRC(curTd, total) {
    let tbody = curTd.parentNode.parentNode;
    // 从第一行计算总的td数量，最后一行也可以，其他行计算不准确
    let cellIndex = -1;
    let rowIndex = curTd.parentNode.rowIndex;
    if (curTd.parentNode.cells.length === total) {
      // 没有被rowspan,colspan影响到的单元格
      cellIndex = curTd.cellIndex;
    } else {
      // 被rowspan影响，往上找rowspan的行
      cellIndex = curTd.cellIndex;
      for (let i = rowIndex - 1; i >= 0; i--) {
        for (let td of tbody.rows[i].cells) {
          if (td.rowSpan > 1) {
            if (td.parentNode.rowIndex + td.rowSpan > rowIndex && curTd.offsetLeft > td.offsetLeft) {
              // curTd所在行下标和当前rowspan重合，并且处于curTd前（使用位置来定位）
              cellIndex += td.colSpan; //加上次单元格colSpan
            }
          }
        }
      }
      // 同一行中td的colspan合并计算
      for (let i = curTd.cellIndex - 1; i >= 0; i--) {
        cellIndex += curTd.parentNode.cells[i].colSpan - 1;
      }
    }
    return JSON.stringify({
      startRowIndex: rowIndex,
      startCellIndex: cellIndex,
      endRowIndex: rowIndex + curTd.rowSpan - 1,
      endCellIndex: cellIndex + curTd.colSpan - 1,
    });
  }

  /**
   * 删除td选中样式
   */
  removeAllSelectedClass() {
    for (let tr of this.table.rows) {
      for (let td of tr.cells) {
        td.classList.remove("selected");
      }
    }
  }

  /**
   * 在范围内td添加选中高亮样式
   */
  addSelectedClass() {
    for (let tr of this.table.rows) {
      for (let td of tr.cells) {
        let rc = this.rcMaps[td.getAttribute("id")];
        // 在范围内加上高亮样式
        if (
          rc.startRowIndex >= this.MMRC.startRowIndex &&
          rc.endRowIndex <= this.MMRC.endRowIndex &&
          rc.startCellIndex >= this.MMRC.startCellIndex &&
          rc.endCellIndex <= this.MMRC.endCellIndex
        ) {
          td.classList.add("selected");
        }
      }
    }
  }

  /**
   * 检查选中范围的rowspan和colspan
   */
  checkMMRC() {
    let rangeChange = false;
    for (let tr of this.table.rows) {
      for (let td of tr.cells) {
        let rc = this.rcMaps[td.getAttribute("id")];
        //判断单元格4个顶点是否在范围内
        if (
          (rc.startRowIndex >= this.MMRC.startRowIndex &&
            rc.startRowIndex <= this.MMRC.endRowIndex &&
            rc.startCellIndex >= this.MMRC.startCellIndex &&
            rc.startCellIndex <= this.MMRC.endCellIndex) || // 左上
          (rc.endRowIndex >= this.MMRC.startRowIndex &&
            rc.endRowIndex <= this.MMRC.endRowIndex &&
            rc.startCellIndex >= this.MMRC.startCellIndex &&
            rc.startCellIndex <= this.MMRC.endCellIndex) || // 左下
          (rc.startRowIndex >= this.MMRC.startRowIndex &&
            rc.startRowIndex <= this.MMRC.endRowIndex &&
            rc.endCellIndex >= this.MMRC.startCellIndex &&
            rc.endCellIndex <= this.MMRC.endCellIndex) || // 右上
          (rc.endRowIndex >= this.MMRC.startRowIndex &&
            rc.endRowIndex <= this.MMRC.endRowIndex &&
            rc.endCellIndex >= this.MMRC.startCellIndex &&
            rc.endCellIndex <= this.MMRC.endCellIndex) // 右下
        ) {
          // debugger
          let startRowIndex = Math.min.call(null, this.MMRC.startRowIndex, rc.startRowIndex);
          let endRowIndex = Math.max.call(null, this.MMRC.endRowIndex, rc.endRowIndex);
          let startCellIndex = Math.min.call(null, this.MMRC.startCellIndex, rc.startCellIndex);
          let endCellIndex = Math.max.call(null, this.MMRC.endCellIndex, rc.endCellIndex);
          if (this.MMRC.startRowIndex > startRowIndex) {
            this.MMRC.startRowIndex = startRowIndex;
            rangeChange = true;
          }
          if (this.MMRC.startCellIndex > startCellIndex) {
            this.MMRC.startCellIndex = startCellIndex;
            rangeChange = true;
          }
          if (this.MMRC.endRowIndex < endRowIndex) {
            this.MMRC.endRowIndex = endRowIndex;
            rangeChange = true;
          }
          if (this.MMRC.endCellIndex < endCellIndex) {
            this.MMRC.endCellIndex = endCellIndex;
            rangeChange = true;
          }
        }
      }
    }
    //范围有变化继续扩展
    if (rangeChange) {
      this.checkMMRC(this.table);
    }
  }

  /**
   * Mousedown event
   */
  onMousedown(e) {
    // 阻止冒泡
    if (e.stopPropagation) {
    }
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.cancelBubble = true;
    e.returnValue = false;

    //鼠标按下事件
    let o = e.target;
    if (o.tagName === "TD") {
      this.removeAllSelectedClass();
      //绑定事件
      this.endTD = o;
      this.startTD = o;
      this.startTD.classList.add("selected");
      this.MMRC = this.rcMaps[o.getAttribute("id")];
    }

    const onMousemove = (e) => {
      this.onMousemove(e);
    };

    this.table.addEventListener("mousemove", onMousemove, false);
    this.table.addEventListener(
      "mouseup",
      () => {
        this.table.removeEventListener("mousemove", onMousemove);
      },
      false
    );

    return false;
  };

  /**
   * Mousemove event
   */
  onMousemove(e) {
    // as HTMLTableCellElement
    let o = e.target;
    if (o.tagName === "TD" && ((this.endTD !== o && this.startTD !== o) || (this.endTD && this.startTD === o))) {
      // 不在开始td和结束td移动时再触发检查
      this.endTD = o;
      this.removeAllSelectedClass();

      let startRC = this.rcMaps[this.startTD.getAttribute("id")];
      let endRC = this.rcMaps[this.endTD.getAttribute("id")];

      // 求2个单元格的开始rowIndex，结束rowIndex，开始cellIndex和结束cellIndex
      let startRowIndex = Math.min.call(null, startRC.startRowIndex, endRC.startRowIndex);
      let endRowIndex = Math.max.call(null, startRC.endRowIndex, endRC.endRowIndex);
      let startCellIndex = Math.min.call(null, startRC.startCellIndex, endRC.startCellIndex);
      let endCellIndex = Math.max.call(null, startRC.endCellIndex, endRC.endCellIndex);

      this.MMRC = { startRowIndex, startCellIndex, endRowIndex, endCellIndex };

      this.checkMMRC(this.table);
      this.addSelectedClass(this.table);
    }
  }

  /**
   * 获取 cell text
   */
  getCellText() {
    let text = [];
    for (let tr of this.table.rows) {
      let hit = false;
      for (let td of tr.cells) {
        if (td.classList.contains("selected")) {
          text.push(td.innerHTML);
        }
      }
    }
    return text.join(",");
  }

  /**
   * 合并单元格
   */
  mergeCells() {
    // 开始结束td不相同确认合并
    if (this.startTD && this.endTD && this.startTD !== this.endTD) {
      let tds = Array.from(this.table.querySelectorAll("td.selected"));
      let firstTD = tds[0];
      let html = this.getCellText();

      for (let i = 1; i < tds.length; i++) {
        tds[i].parentNode.removeChild(tds[i]);
      }
      firstTD.innerHTML = html;

      // 更新合并的第一个单元格的缓存rc数据为所跨列和行
      firstTD.setAttribute("colspan", this.MMRC.endCellIndex - this.MMRC.startCellIndex + 1);
      firstTD.setAttribute("rowspan", this.MMRC.endRowIndex - this.MMRC.startRowIndex + 1);

      this.rcMaps[firstTD.getAttribute("id")] = this.MMRC;
    }
    this.removeAllSelectedClass();
    this.MMRC = null;
    this.startTD = null;
    this.endTD = null;
  }

  /**
   * 找到拆分单元格时出现rowspan插入到新行中的单元格下标
   * @param {HTMLTableElement} nextTr
   * @param {int} offsetRight
   * @returns
   */
  getInsertCellIndex(nextTr, offsetRight) {
    for (let td of nextTr.cells) {
      if (Math.abs(td.offsetLeft - offsetRight) < 2) {
        // 注意这里内容宽度会出现小数点，但是用offsetWidth取值是整数有舍入操作，所以要取差值
        return td.cellIndex;
      }
    }
    // 找不到说明是在第一列合并的，返回0
    return 0;
  }

  /**
   * 拆分
   */
  splitCells() {
    if (this.MMRC) {
      if (
        this.MMRC.startRowIndex === this.MMRC.endRowIndex && 
        this.MMRC.startCellIndex === this.MMRC.endCellIndex
      ) {
        alert("无法拆分！");
        return;
      }

      let rows = Array.from(this.table.rows);
      let cells;
      for (let tr of rows) {
        // 拷贝到数组，而不是直接遍历tr.cells，cells会受cellspan，rowspan影响
        cells = Array.from(tr.cells);
        for (let td of cells) {
          let rc = this.rcMaps[td.getAttribute("id")];
          // rowspan新增的单元格跳过
          if (!rc) {
            continue;
          }
          // 在范围内
          if (
            rc.startRowIndex >= this.MMRC.startRowIndex &&
            rc.endRowIndex <= this.MMRC.endRowIndex &&
            rc.startCellIndex >= this.MMRC.startCellIndex &&
            rc.endCellIndex <= this.MMRC.endCellIndex
          ) {
            let colSpan = rc.endCellIndex - rc.startCellIndex;
            // 跨列
            if (colSpan > 0) {
              for (let i = 0, j = colSpan; i < j; i++) {
                // 这个是在后面插入，前面插入+1
                tr.insertCell(td.cellIndex + 1);
              }
              td.colSpan = 1;
            }
            let rowSpan = rc.endRowIndex - rc.startRowIndex;
            // 跨行
            if (rowSpan > 0) {
              for (let k = 1; k <= rowSpan; k++) {
                let nextTr = this.table.rows[rc.startRowIndex + k];
                let cellIndex = this.getInsertCellIndex(nextTr, td.offsetLeft + td.offsetWidth);
                for (let i = 0; i < colSpan + 1; i++) {
                  nextTr.insertCell(cellIndex);
                }
              }
              td.rowSpan = 1;
            }
          }
        }
      }
    }
    this.removeAllSelectedClass();
    // 更新rc属性
    this.updateTdRc();
  }

  /**
   * 删除Column
   */
  deleteColumn() {
    let col = parseInt(prompt("请输入原始列下标！"));
    if (isNaN(col) || col >= this.totalCell) {
      alert(`列下标需要介于0~${this.totalCell - 1}之间！`);
      return;
    }
    for (let tr of this.table.rows) {
      for (let td of tr.cells) {
        let rc = this.rcMaps[td.getAttribute("id")];
        if (rc.startCellIndex <= col && col <= rc.endCellIndex) {
          if (rc.startCellIndex === rc.endCellIndex) {
            //只有一个，删掉
            td.parentNode.removeChild(td);
          } else {
            td.colSpan -= 1;
          }
          break; //后续单元格不需要再遍历在，直接下一行
        }
      }
    }
    // 更新rc属性
    this.updateTdRc();
  }
}
