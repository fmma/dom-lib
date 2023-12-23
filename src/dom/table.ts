import { SingleNodeDom, Dom, Getter, Elem, Txt, Fix, constant, appendNode } from './base'
import { ForEach } from './foreach'
import { Button, InputNumber } from './input'

export class Table extends SingleNodeDom<HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<string>;
    constructor(
        readonly cols: Getter<string[]>,
        readonly rows: Dom[]) {
        super(document.createElement("table"));
        this.thead = appendNode(this.node,document.createElement("thead"));
        this.tbody = appendNode(this.node, document.createElement("tbody"));
        appendNode(this.node, this.thead);
        appendNode(this.node, this.tbody);
        this.theadCells = new ForEach<string>(this.cols, (getCol) => new Elem("th", new Txt(async () => getCol())));
        appendNode(this.thead, this.theadCells.fragment());
        rows.forEach(row => appendNode(this.tbody, row.fragment()));
    }

    async feedModel() {
        this.theadCells.feedModel();
        this.rows.forEach(row => row.feedModel());
    }

    control(fix: Fix) {
        this.theadCells.control(fix);
        this.rows.forEach(row => row.control(fix));
    }
}

export class TableSmart<R> extends SingleNodeDom<HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<string>;
    tbodyRows: ForEach<R>;
    constructor(
        readonly cols: Getter<string[]>,
        readonly rows: Getter<R[]>,
        readonly row: (getRow: () => R) => Dom[]) {
        super(document.createElement("table"));
        this.thead = appendNode(this.node, document.createElement("thead"));
        this.tbody = appendNode(this.node, document.createElement("tbody"));
        appendNode(this.node, this.thead);
        appendNode(this.node, this.tbody);
        this.theadCells = new ForEach<string>(cols, (getCol) => new Elem("th", new Txt(async () => getCol())));
        appendNode(this.thead, this.theadCells.fragment());

        const rowsPrime = (getRow: () => R) => new Elem("tr", ...this.row(getRow).map(r => new Elem("td", r)));
        this.tbodyRows = new ForEach(this.rows, rowsPrime);
        appendNode(this.tbody, this.tbodyRows.fragment());
    }

    async feedModel() {
        this.theadCells.feedModel();
        this.tbodyRows.feedModel();
    }

    control(fix: Fix) {
        this.theadCells.control(fix);
        this.tbodyRows.control(fix);
    }
}

export function pagedTable<R>(
    cols: Getter<string[]>,
    rows: Getter<R[]>,
    row: (getRow: () => R) => Dom[]): Elem {
    let pageSize = 5;
    let pageIndex = 0;
    const div = new Elem("div"
        , new TableSmart(cols,
            async () => {
                const rs = await rows();
                return rs.slice(pageIndex, pageIndex + pageSize);
            },
            row)
        , new Txt(constant("page:"))
        , new Button(constant("<"), async () => {
            if(pageIndex > 0)
                pageIndex = Math.max(0, pageIndex - pageSize);
          })
          , new InputNumber(constant("page"),   [ async () => Math.ceil(pageIndex / pageSize) + 1
                                                , async (y) => {pageIndex = (y - 1) * pageSize; return}
                                                ])
          , new Txt(async () => {
            const rs = await rows();
            return "/" + Math.ceil(rs.length / pageSize).toString() + " ";
          })
        , new Button(constant(">"), async () => {
            const rs = await rows();
            if(pageIndex + pageSize < rs.length)
                pageIndex = Math.min(pageIndex + pageSize, rs.length);
            return;
          })
        , new Txt(constant("page size:"))
        , new InputNumber(constant("page size"), [async () => pageSize, async (v) => {pageSize = v; return}])
        , new Txt(async () => {
          const rs = await rows();
          return "/" + Math.ceil(rs.length).toString() + " ";
        })
        );
    return div;
}