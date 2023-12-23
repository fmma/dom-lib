import { SingleNodeDom, Getter, Prop, Fix, Action, Setter } from './base';

export abstract class Input<T> extends SingleNodeDom<HTMLInputElement>{
    constructor(readonly placeholder: Getter<string>,
                readonly prop: Prop<T>,
                inputType: string) {
        super(document.createElement("input"));
        this.node.style.width = "100px";
        this.node.type = inputType;
    }

    abstract readValue(): T | null;

    abstract showValue(value: T): string;

    async feedModel() {
        if(!isElementInViewport(this.node))
            return;
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

function isElementInViewport (el: Element) {
    var rect = el.getBoundingClientRect();
    return (
        rect.top + rect.height + 200 >= 0 &&
        rect.left + rect.width + 200 >= 0 &&
        rect.bottom - rect.height - 200 <= (window.innerHeight || document.documentElement.clientHeight) && 
        rect.right - rect.width - 200 <= (window.innerWidth || document.documentElement.clientWidth)
    );
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
