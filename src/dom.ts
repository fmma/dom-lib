export type Action = () => void | Promise<void>;
export type Setter<T> = (newValue: T) => void | Promise<void>;
export type Getter<T> = () => T | Promise<T>;
export type Prop<T> = [Getter<T>, Setter<T>];
export type Fix = (callback: () => void | Promise<void>) => void;

export abstract class Dom {
    abstract fragment(): Node;

    abstract remove(): void;

    abstract feedModel(): Promise<void>;

    control(fix: Fix): void {
    }
}

export abstract class SingleNodeDom<N extends Node> extends Dom {
    constructor(protected readonly node: N) {
        super();
    }

    fragment() {
        return this.node;
    }

    remove() {
        removeMe(this.node);
    }
}

export class Txt extends SingleNodeDom<Text> {
    constructor(readonly get: Getter<string>) {
        super(document.createTextNode(""));
    }

    async feedModel() {
        const string = await this.get();
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}

export class Elem extends SingleNodeDom<Element> {
    private children: Dom[];
    constructor(tag: string, ...children : Dom[]) {
        super(document.createElement(tag));
        this.children = children;
        children.forEach(c => this.node.appendChild(c.fragment()));
    }
    
    async feedModel() {
        await Promise.all(this.children.map(c => c.feedModel()));
    }

    control(fix: Fix) {
        this.children.forEach(c => c.control(fix));
    }
}

export class P<M> extends SingleNodeDom<HTMLParagraphElement>{
    constructor(readonly get: Getter<string>) {
        super(document.createElement("p"));
    }
    
    async feedModel() {
        const string = await this.get();
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}

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


export function labelled<M>(label: Getter<string>, value: Dom): Elem {
    return new Elem("div",
        new Txt(label),
        value
    );
}

export function constant<T>(value: T): Getter<T> {
    return () => value;
}

export function readonlyProp<T>(get: Getter<T>): Prop<T> {
    return [get, v => {return;}];
}

export function mapGet<T, U>(f: (x: T) => U): (get: Getter<T>) => Getter<U> {
    return get => async () => f(await get());
}

export function mapSet<T, U>(f: (x: U) => T): (set: Setter<T>) => Setter<U> {
    return set => x => set(f(x));
}

export function mapProp<T, U>(f: (x: T) => U, g: (y: U) => T): (prop: Prop<T>) => Prop<U> {
    return prop => [mapGet<T, U>(f)(prop[0]), mapSet<T, U>(g)(prop[1])];
}

export function mvc<M>(root: Dom): Promise<void> {
    root.control(async (callback) => {
        await callback();
        await root.feedModel();
        return;
    });
    return root.feedModel();
}

export async function renderPage<M>(root: Dom): Promise<void> {
    return new Promise<void>( (resolve, reject) => {
        const go = mvc(root);
        window.onload = async () => {
            document.body.appendChild(root.fragment());
            resolve(go);
        };
    });
}

export abstract class Input<T> extends SingleNodeDom<HTMLInputElement>{
    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<T>,
                inputType: string) {
        super(document.createElement("input"));
        this.node.type = inputType;
    }

    abstract readValue(): T | null;

    abstract showValue(value: T): string;

    async feedModel() {
        const v = await this.prop[0]();
        if(this.node !== document.activeElement) {
            if(v !== this.readValue())
                this.node.value = this.showValue(v);
        }
        const placeholder = await this.placeholder();
        if(placeholder !== this.node.placeholder)
            this.node.placeholder = placeholder;
    }

    control(fix: Fix) {
        this.node.oninput = () => {
            const value = this.readValue();
            if(value != null) {
                fix(() => this.prop[1](value));
            }
        }
    }
}

export class InputNumber extends Input<number>{

    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<number>) {
        super(placeholder, prop, "number");
    }

    showValue(value: number): string {
        return value.toString();
    }

    readValue(): number | null {
        if(isNaN(this.node.valueAsNumber))
            return null;
        return this.node.valueAsNumber;
    }
}

export class InputText extends Input<string>{

    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<string>) {
        super(placeholder, prop, "text");
    }
    
    showValue(value: string): string {
        return value;
    }

    readValue(): string | null {
        return this.node.value;
    }
}

export class InputDate extends Input<Date>{

    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<Date>) {
        super(placeholder, prop, "date");
    }
    
    showValue(date: Date): string {
        const day = ("0" + date.getDate()).slice(-2);
        const month = ("0" + (date.getMonth() + 1)).slice(-2);
        return date.getFullYear() + "-" + month + "-" + day;
    }

    readValue(): Date | null {
        return this.node.valueAsDate;
    }
}

export class InputTime extends Input<Date>{

    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<Date>) {
        super(placeholder, prop, "time");
    }
    
    showValue(date: Date): string {
        const hour = ("0" + date.getHours()).slice(-2);
        const minute = ("0" + date.getMinutes()).slice(-2);
        return hour + ":" + minute;
    }

    readValue(): Date | null {
        return this.node.valueAsDate;
    }
}

export class Button extends SingleNodeDom<HTMLButtonElement>{
    constructor(readonly text: Getter<string>,
                readonly click: Action) {
        super(document.createElement("button"));
    }

    async feedModel() {
        const text = await this.text();
        if(text !== this.node.textContent)
            this.node.textContent = text;
    }

    control(fix: Fix) {
        this.node.onclick = () => {
            fix(this.click);
        }
    }
}

export class Checkbox<M> extends SingleNodeDom<HTMLInputElement> {
    constructor(readonly get: Getter<boolean>,
                readonly set: Setter<boolean>) {
        super(document.createElement("input"));
        this.node.type = "checkbox";
    }
    
    async feedModel() {
        if(this.node !== document.activeElement) {   
            const checked = await this.get()
            if(checked !== this.node.checked)
                this.node.checked = checked;
        }
    }

    control(fix: Fix) {
        this.node.onchange = () => {
            fix(() => this.set(this.node.checked));
        }
    }
}

export class ForEach<T> extends Dom{
    private openTag = document.createComment("<foreach>");
    private closeTag = document.createComment("</foreach>");
    private doms: Dom[] = [];
    private n: number = 0; // Number of active DOM nodes.
    private fix: null | ((i: number) => Fix) = null;
    private currentRow!: T;

    constructor(readonly collection: Getter<T[]>,
                readonly loopBody: (getRow: () => T) => Dom) {
        super();
    }

    fragment() {
        const frag = document.createDocumentFragment();
        frag.appendChild(this.openTag);
        for(let i = 0; i < this.n; ++i) {
            frag.appendChild(this.doms[i].fragment());
        }
        frag.appendChild(this.closeTag);
        return frag;
    }

    remove() {
        removeMe(this.openTag);
        for(let i = 0; i < this.n; ++i)
            this.doms[i].remove();
        removeMe(this.closeTag);
    }
    
    async feedModel() {
        const collection = await this.collection();
        const n = collection.length;
        this.newN(Math.max(0, n));
        this.doms.slice(0, this.n).forEach(
            async (node, i) => {
                this.currentRow = collection[i];
                await node.feedModel();
            });
        return;
    }

    control(fix: Fix) {
        this.fix = 
            i => 
            callback => 
            fix(async () => {
                const collection = await this.collection();
                this.currentRow = collection[i];
                return callback();
            });
    }
    
    private ensureCapacity(n: number) {
        for(let i = this.doms.length; i < n; ++i) {
            const dom = this.loopBody(() => this.currentRow);
            if(this.fix) {
                dom.control(this.fix(i));   
            }
            this.doms.push(dom);
        }
    }

    private newN(n: number) {
        for(let i = n; i < this.n; ++ i) {
            this.doms[i].remove();
        }
        this.ensureCapacity(n);
        const frag = document.createDocumentFragment();
        for(let i = this.n; i < n; ++ i) {
            frag.appendChild(this.doms[i].fragment());
        }
        insertMeBefore(frag, this.closeTag);
        this.n = n;
    }
}


/// UTILITY
export function flatten<T>(xss: T[][]): T[] {
    return [].concat.apply([], xss);
}

// Slow! use map reduce if possible
export function foldl<A, B>(f: (b: B, a: A) => B, ac: B, xs: A[]): B {
    return (xs.length === 0) && ac || foldl(f, f(ac, xs[0]), xs.slice(1));
};

export function insertMeBefore(node: Node, beforeNode: Node) {
    if(beforeNode.parentElement)
        beforeNode.parentElement.insertBefore(node, beforeNode);
}

export function removeMe(node: Node) {
    if(node.parentElement)
        node.parentElement.removeChild(node);
}
