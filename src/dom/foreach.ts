import { Dom, Fix, Getter, removeMe, appendNode } from './base'

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
        appendNode(frag, this.openTag);
        for(let i = 0; i < this.n; ++i) {
            appendNode(frag, this.doms[i].fragment());
        }
        appendNode(frag, this.closeTag);
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
            appendNode(frag, this.doms[i].fragment());
        }
        insertMeBefore(frag, this.closeTag);
        this.n = n;
    }
}

const insertMeBefore = (node: Node, beforeNode: Node) => {
    if(beforeNode.parentElement)
        beforeNode.parentElement.insertBefore(node, beforeNode);
}
