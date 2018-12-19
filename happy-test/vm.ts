export type Opaque = any;

export type InstructionList = Opaque[];

export type Opcode = number;

export interface IBuilder {
  stack: Stack<Opaque>;
  pc: ProgramCounter;
  program: Program;
}

export type Op = (vm: IBuilder) => Promise<void>;

export interface IConfig {
  addOp: (opcode: string, operation: Op) => void;
}

export class Stack<T> {
  private inner: T[] = [];

  push(data: T) {
    if (this.inner.length > 63) {
      throw new Error("Stack overflow");
    }
    this.inner.push(data);
  }

  pop() {
    return this.inner.pop();
  }

  peek() {
    return this.inner[this.inner.length - 1];
  }
}

export class ProgramCounter extends Stack<number> {
  constructor() {
    super();
    this.push(0);
  }

  halt(): void {
    this.push(-1);
  }

  advance(distance = 1): void {
    const last = this.pop();

    if (last === undefined) {
      throw new Error("No pc on the pc stack to advance from");
    }

    this.push(last + distance);
  }

  jump(addr: number) {
    this.pop();
    this.push(addr);
  }
}

export class Program implements IterableIterator<Opaque> {
  constructor(
    private pc: ProgramCounter,
    private instructions: InstructionList
  ) {}

  [Symbol.iterator]() {
    return this;
  }

  next() {
    const pc = this.pc.peek();
    return { done: pc === -1, value: this.instructions[pc] };
  }
}

export class VM implements AsyncIterableIterator<void> {
  private program: Program;
  private stack = new Stack<Opaque>();
  private pc = new ProgramCounter();
  private ops = new Map<string, Op>();

  constructor(config: (config: IConfig) => void) {
    this.program = new Program(this.pc, []);
    config({
      addOp: (op, builder) => {
        this.ops.set(op, builder);
      }
    });
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  load(instructions: InstructionList): void {
    this.pc = new ProgramCounter();
    this.program = new Program(this.pc, instructions);
  }

  async next() {
    const instruction = this.program.next().value;
    const op = this.ops.get(instruction)!;

    if (op === undefined) {
      throw new Error(`Could not find op with pc @ ${this.pc.peek()}`);
    }

    const vm = { pc: this.pc, stack: this.stack, program: this.program };

    await op(vm);

    return { done: this.pc.peek() === -1, value: undefined };
  }

  async run(): Promise<void> {
    for await (let _ of this) {
      // noop
    }
  }
}