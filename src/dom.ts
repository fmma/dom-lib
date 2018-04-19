type Action<M> = (model: M) => Promise<M>;
type Setter<M, T> = (newValue: T) => (model: M) => Promise<M>;
type Getter<M, T> = (model: M) => Promise<T>;
type Prop<M, T> = [Getter<M, T>, Setter<M, T>];

abstract class Dom<M> {
    abstract fragment(): Node;

    abstract remove(): void;

    abstract feedModel(model: M): Promise<void>;

    control(fix: (callback: (m: M) => Promise<M>) => void): void {
    }
}

abstract class SingleNodeDom<M, N extends Node> extends Dom<M> {
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

class Txt<M> extends SingleNodeDom<M, Text> {
    constructor(readonly get: Getter<M, string>) {
        super(document.createTextNode(""));
    }

    async feedModel(model: M) {
        const string = await this.get(model);
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
    }
}

class Elem<M> extends SingleNodeDom<M, Element> {
    private children: Dom<M>[];
    constructor(tag: string, ...children : Dom<M>[]) {
        super(document.createElement(tag));
        this.children = children;
        children.forEach(c => this.node.appendChild(c.fragment()));
    }
    
    async feedModel(model: M) {
        await Promise.all(this.children.map(c => c.feedModel(model)));
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.children.forEach(c => c.control(fix));
    }
}

class ForEach<M, T> extends Dom<M>{
    private openTag = document.createComment("<foreach>");
    private closeTag = document.createComment("</foreach>");
    private doms: Dom<[M, T]>[] = [];
    private n: number = 0; // Number of active DOM nodes.
    private fix: null | ((i: number) => (callback: (m: [M, T]) => Promise<[M, T]>) => void) = null;

    constructor(readonly collection: Getter<M, T[]>,
                readonly loopBody: () => Dom<[M, T]>) {
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
    
    async feedModel(model: M) {
        const collection = await this.collection(model);
        const n = collection.length;
        this.newN(Math.max(0, n));
        const nodes = await Promise.all(
            this.doms.slice(0, this.n).map(
                (node, i) => node.feedModel([model, collection[i]])));
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.fix = i => 
            (callback) => 
            fix(async (m) => {
            const collection = await this.collection(m);
            const p = await callback([m, collection[i]]);
            // collection[i] = p[1];
            return p[0];// this.collection[1](collection)(p[0]);
        });
    }
    
    private ensureCapacity(n: number) {
        for(let i = this.doms.length; i < n; ++i) {
            const dom = this.loopBody();
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

class P<M> extends SingleNodeDom<M, HTMLParagraphElement>{
    constructor(readonly get: Getter<M, string>) {
        super(document.createElement("p"));
    }
    
    async feedModel(model: M) {
        const string = await this.get(model);
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}

class Checkbox<M> extends SingleNodeDom<M, HTMLInputElement> {
    constructor(readonly get: Getter<M, boolean>,
                readonly set: Setter<M, boolean>) {
        super(document.createElement("input"));
        this.node.type = "checkbox";
    }
    
    async feedModel(model: M) {
        if(this.node !== document.activeElement) {   
            const checked = await this.get(model)
            if(checked !== this.node.checked)
                this.node.checked = checked;
        }
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.node.onchange = () => {
            fix(this.set(this.node.checked));
        }
    }
}

abstract class Input<M, T> extends SingleNodeDom<M, HTMLInputElement>{
    constructor(readonly placeholder: Getter<M, string>,
                readonly prop: Prop<M, T>,
                inputType: string) {
        super(document.createElement("input"));
        this.node.type = inputType;
    }

    abstract readValue(): T | null;

    abstract showValue(value: T): string;

    async feedModel(model: M) {
        const v = await this.prop[0](model);
        if(this.node !== document.activeElement) {
            if(v !== this.readValue())
                this.node.value = this.showValue(v);
        }
        const placeholder = await this.placeholder(model);
        if(placeholder !== this.node.placeholder)
            this.node.placeholder = placeholder;
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.node.oninput = () => {
            const value = this.readValue();
            if(value != null) {
                fix(this.prop[1](value));
            }
        }
    }
}

class InputNumber<M> extends Input<M, number>{

    constructor(readonly placeholder: Getter<M, string>,
                readonly prop: Prop<M, number>) {
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

class InputText<M> extends Input<M, string>{

    constructor(readonly placeholder: Getter<M, string>,
                readonly prop: Prop<M, string>) {
        super(placeholder, prop, "text");
    }
    
    showValue(value: string): string {
        return value;
    }

    readValue(): string | null {
        return this.node.value;
    }
}

class InputDate<M> extends Input<M, Date>{

    constructor(readonly placeholder: Getter<M, string>,
                readonly prop: Prop<M, Date>) {
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

class InputTime<M> extends Input<M, Date>{

    constructor(readonly placeholder: Getter<M, string>,
                readonly prop: Prop<M, Date>) {
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

class Button<M> extends SingleNodeDom<M, HTMLButtonElement>{
    constructor(readonly text: Getter<M, string>,
                readonly click: Action<M>) {
        super(document.createElement("button"));
    }

    async feedModel(model: M) {
        const text = await this.text(model);
        if(text !== this.node.textContent)
            this.node.textContent = text;
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.node.onclick = () => {
            fix(this.click);
        }
    }
}

class Table<M> extends SingleNodeDom<M, HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<M, string>;
    constructor(
        readonly cols: Getter<M, string[]>,
        readonly rows: Dom<M>[]) {
        super(document.createElement("table"));
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<M, string>(this.cols, () => new Elem("th", new Txt(get("1"))));
        this.thead.appendChild(this.theadCells.fragment());
        rows.forEach(row => this.tbody.appendChild(row.fragment()));
    }

    async feedModel(model: M) {
        this.theadCells.feedModel(model);
        this.rows.forEach(row => row.feedModel(model));
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.theadCells.control(fix);
        this.rows.forEach(row => row.control(fix));
    }
}

class TableSmart<M, R> extends SingleNodeDom<M, HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<M, string>;
    tbodyRows: ForEach<M, R>;
    constructor(
        readonly cols: Getter<M, string[]>,
        readonly rows: Getter<M, R[]>,
        readonly row: () => Dom<[M, R]>[]) {
        super(document.createElement("table"));
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<M, string>(cols, () => new Elem("th", new Txt(get("1"))));
        this.thead.appendChild(this.theadCells.fragment());

        const rowsPrime = () => new Elem<[M, R]>("tr", ...this.row().map(r => new Elem("td", r)));
        this.tbodyRows = new ForEach(this.rows, rowsPrime);
        this.tbody.appendChild(this.tbodyRows.fragment());
    }

    async feedModel(model: M) {
        this.theadCells.feedModel(model);
        this.tbodyRows.feedModel(model);
    }

    control(fix: (callback: (m: M) => Promise<M>) => void) {
        this.theadCells.control(fix);
        this.tbodyRows.control(fix);
    }
}

function pagedTable<M, R>(
    cols: Getter<M, string[]>,
    rows: Getter<M, R[]>,
    row: () => Dom<[M, R]>[]): Elem<M> {
    let ps = 5;
    let p = 0;
    const pageSize: Prop<M, number> = [async (m) => ps, v => async (m) => {ps = v; return m}];
    const page: Prop<M, number> = [async (m) => p, v => async (m) => {p = v; return m}];
    const div = new Elem("div"
        , new TableSmart(cols, 
            async (m) => {
                const rs = await rows(m);
                const i = await page[0](m);
                const n = await pageSize[0](m);
                return rs.slice(i, i + n);
            },
            () => row())
        , new Txt(constant("page:"))
        , new Button(constant("prev"), async (m) => {
            const i = await page[0](m);
            const n = await pageSize[0](m);
            return i > 0 ? page[1](Math.max(0, i-n))(m) : m;
          })
          , new InputNumber(constant("page"), [async (x) => Math.ceil(p / ps) + 1, y => async(m) => {p = (y - 1) * ps; return m}])
          , new Txt(async (m) => {
            const rs = await rows(m);
            const n = await pageSize[0](m);
            return "/" + Math.ceil(rs.length / n).toString() + " ";
          })
        , new Button(constant("next"), async (m) => {
            const i = await page[0](m);
            const n = await pageSize[0](m);
            const rs = await rows(m);
            return i + n < rs.length ? page[1](Math.min(i+n, rs.length))(m) : m;
          })
        , new Txt(constant("page size:"))
        , new InputNumber(constant("pagesize"), pageSize)
        , new Txt(async (m) => {
          const rs = await rows(m);
          return "/" + Math.ceil(rs.length).toString() + " ";
        })
        );
    return div;
}


function labelled<M>(label: Getter<M, string>, value: Dom<M>): Elem<M> {
    return new Elem("div",
        new Txt(label),
        value
    );
}

function constant<M, T>(value: T): Getter<M, T> {
    return async () => value;
}

function get<M, K extends keyof M>(key: K): Getter<M, M[K]> {
    return async (m) => m[key];
}

function readonlyProp<M, T>(get: Getter<M, T>): Prop<M, T> {
    return [get, v => async (m) => m];
}

function mapGet<M, T, U>(f: (x: T) => U): (get: Getter<M, T>) => Getter<M, U> {
    return get => async (m) => f(await get(m));
}

function getLens<M, T, U>(get: Getter<M, T>): (g: Getter<T, U>) => Getter<M, U> {
    return g => async (m) => g(await get(m));
}

function mapSet<M, T, U>(f: (x: U) => T): (set: Setter<M, T>) => Setter<M, U> {
    return set => x => async (m) => set(f(x))(m);
}

function setLens<M, T, U>(prop: Prop<M, T>): (s: Setter<T, U>) => Setter<M, U> {
    return s => x => async (m) => prop[1](await s(x)(await prop[0](m)))(m);
}
function mapProp<M, T, U>(f: (x: T) => U, g: (y: U) => T): (prop: Prop<M, T>) => Prop<M, U> {
    return prop => [mapGet<M, T, U>(f)(prop[0]), mapSet<M, T, U>(g)(prop[1])];
}

function lens<M, T, U>(prop: Prop<M, T>): (prop: Prop<T, U>) => Prop<M, U> {
    return p => [getLens<M, T, U>(prop[0])(p[0]), setLens<M, T, U>(prop)(p[1])];
}

function set<M, K extends keyof M>(key: K): Setter<M, M[K]> {
    return x => async (m) => {
        m[key] = x; // TODO side-effecty
        return m;
    }
}

function prop<M, K extends keyof M>(key: K): Prop<M, M[K]> {
    return [get(key), set(key)];
}

function mvc<M>(root: Dom<M>): (model: M) => Promise<void> {
    return async (model) => {
        root.control(async (callback) => {
            model = await callback(model);
            return root.feedModel(model);
        });
        return root.feedModel(model);
    }
}

async function renderPage<M>(root: Dom<M>, initialModel: Promise<M>): Promise<void> {
    return new Promise<void>( (resolve, reject) => {
        const go = mvc(root);
        window.onload = async () => {
            document.body.appendChild(root.fragment());
            resolve(go(await initialModel));
        };
    });
}

/// UTILITY
function flatten<T>(xss: T[][]): T[] {
    return [].concat.apply([], xss);
}

// Slow! use map reduce if possible
function foldl<A, B>(f: (b: B, a: A) => B, ac: B, xs: A[]): B {
    return (xs.length === 0) && ac || foldl(f, f(ac, xs[0]), xs.slice(1));
};

function insertMeBefore(node: Node, beforeNode: Node) {
    if(beforeNode.parentElement)
        beforeNode.parentElement.insertBefore(node, beforeNode);
}

function removeMe(node: Node) {
    if(node.parentElement)
        node.parentElement.removeChild(node);
}
