import { SingleNodeDom, Dom, Getter, Elem, Txt, Fix, constant } from './base'
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
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<string>(this.cols, (getCol) => new Elem("th", new Txt(async () => getCol())));
        this.thead.appendChild(this.theadCells.fragment());
        rows.forEach(row => this.tbody.appendChild(row.fragment()));
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
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<string>(cols, (getCol) => new Elem("th", new Txt(async () => getCol())));
        this.thead.appendChild(this.theadCells.fragment());

        const rowsPrime = (getRow: () => R) => new Elem("tr", ...this.row(getRow).map(r => new Elem("td", r)));
        this.tbodyRows = new ForEach(this.rows, rowsPrime);
        this.tbody.appendChild(this.tbodyRows.fragment());
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
    let ps = 5;
    let p = 0;
    const div = new Elem("div"
        , new TableSmart(cols,
            async () => {
                const rs = await rows();
                return rs.slice(p, p + ps);
            },
            row)
        , new Txt(constant("page:"))
        , new Button(constant("prev"), async () => {
            if(p > 0)
                p = Math.max(0, p - ps);
          })
          , new InputNumber(constant("page"),   [ async () => Math.ceil(p / ps) + 1
                                                , async (y) => {p = (y - 1) * ps; return}
                                                ])
          , new Txt(async () => {
            const rs = await rows();
            return "/" + Math.ceil(rs.length / ps).toString() + " ";
          })
        , new Button(constant("next"), async () => {
            const rs = await rows();
            if(p + ps < rs.length)
                p = Math.min(p + ps, rs.length);
            return;
          })
        , new Txt(constant("page size:"))
        , new InputNumber(constant("page size"), [async () => ps, async (v) => {ps = v; return}])
        , new Txt(async () => {
          const rs = await rows();
          return "/" + Math.ceil(rs.length).toString() + " ";
        })
        );
    return div;
}