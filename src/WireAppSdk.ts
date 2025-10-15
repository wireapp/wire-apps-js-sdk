export class WireAppSdk {
    private value: string;
  
    constructor(value: string) {
    	this.value = value;
    }
  
    public showValue(): void {
    	console.log(`The value is: ${this.value}`);
    }
}
