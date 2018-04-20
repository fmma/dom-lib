class ForEach<M, T> extends Dom<M>{
    private openTag = document.createComment("<foreach>");
    private closeTag = document.createComment("</foreach>");
    private doms: Dom<[M, T]>[] = [];
    private n: number = 0; // Number of active DOM nodes.
    private fix: null | ((i: number) => Fix<[M, T]>) = null;

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

    control(fix: Fix<M>) {
        this.fix = i => 
            callback => 
            fix(async (m) => {
                const collection = await this.collection(m);
                const p = await callback([m, collection[i]]);
                return;
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
