
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

    control(fix: Fix<M>) {
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

    control(fix: Fix<M>) {
        this.node.onclick = () => {
            fix(this.click);
        }
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

    control(fix: Fix<M>) {
        this.node.onchange = () => {
            fix(this.set(this.node.checked));
        }
    }
}

