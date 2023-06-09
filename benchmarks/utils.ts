import { ActorSubclass } from "@dfinity/agent";
import { stats } from "../src/stats";
import { cyclesPerICP, priceICPInUSD } from "./bm";
import { appendFileSync, existsSync, writeFileSync } from "fs";
import { AttributeKey, AttributeValue, ConsumableEntity } from "../src/declarations/simple/simple.did";

export function formatCycles(cycles: bigint): string {
    // Format cycles as a string with underscores every 3 digits.
    return cycles.toString()
        .split("").reverse().join("")
        .match(/.{1,3}/g)
        .map(x => x.split("").reverse().join(""))
        .reverse().join("_"); // 🤫
}

export function formatCyclesShort(cycles: bigint): string {
    if (cycles < 10e6) {
        return `${cycles / 1_000n}K`;
    }
    return `${formatCycles(cycles / 1_000_000n)}M`;
}

export function priceInUSD(cycles: bigint): number {
    return Number(cycles) / cyclesPerICP * priceICPInUSD;
}

export function createEntity(index: number, attributes: [AttributeKey, AttributeValue][]): ConsumableEntity {
    return { sk: `pk#${pad(index, 4)}`, attributes }
}

export function createSK(index : number, j : number) : string {
    return `pk#${index == 0 ? "" : index}${pad(j, 5)}`;
}

export function createEntities(index: number, size: number, attributes: [AttributeKey, AttributeValue][]): ConsumableEntity[] {
    return shuffle([...new Array(size)].map((_, j) => ({
        sk: createSK(index, j), attributes
    })))
};

export function pad(num: number, size: number): string {
    let s = num.toString();
    while (s.length < size) s = "0" + s;
    return s;
}

export function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length;
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

// This is the type of the stats returned by the Watcher class.
export type Stats = {
    // Time in nanoseconds.
    time: bigint,
    // Cycles used.
    cycles: bigint,
    // Heap size in bytes.
    heapSize: bigint,
    // Total heap size in bytes.
    totalHeapSize: bigint,
};

// This class is used to measure the time and cycles used by a function.
export class Watcher {

    private actor: ActorSubclass<stats>;
    private startTime: bigint;
    private startCycles: bigint;
    private startHeapSize: bigint;

    constructor(actor: ActorSubclass<stats>) {
        this.startTime = 0n;
        this.startCycles = 0n;
        this.startHeapSize = 0n;
        this.actor = actor;
    }

    public async startTimer() {
        const stats = await this.actor.stats();
        this.startCycles = stats[0];
        this.startHeapSize = stats[1];
        this.startTime = process.hrtime.bigint();
    }

    public async stopTimer(): Promise<Stats> {
        const time = process.hrtime.bigint() - this.startTime;
        const stats = await this.actor.stats()
        const cycles = this.startCycles - stats[0];
        const heapSize = stats[1] - this.startHeapSize;
        return { time, cycles, heapSize, totalHeapSize: stats[1] };
    };

}

export class Writer {

    public path: string;
    private query: boolean;

    constructor(path: string, query: boolean = false) {
        this.path = path;
        this.query = query;
    }

    public fileExists(): boolean {
        return existsSync(this.path);
    }

    public writeHeader() {
        writeFileSync(
            this.path,
            `Size,Time${this.query ? "" :",Cycles,Price"},Instructions${this.query ? "" : ",HeapSize,TotalHeapSize"}\n`
        );
    }

    public writeLine(size: number, stats: Stats, instructions: bigint) {
        appendFileSync(
            this.path,
            `${size},${stats.time}${this.query ? "" : `,${stats.cycles},${priceInUSD(stats.cycles)}`},${instructions}${this.query ? "" : `,${stats.heapSize},${stats.totalHeapSize}`}\n`,
            { flag: "a" }
        );
    }

}
