import { createActor } from "../src/declarations/simple";
import { AttributeKey, AttributeValue } from "../src/declarations/simple/simple.did";
import canisterIds from "../.dfx/local/canister_ids.json";
import { Watcher, Writer, createEntities, createSK } from "./utils";

const size = 5_000, scanSize = 500n;
const attributes: [AttributeKey, AttributeValue][] = [["name", { "bool": true }]];

// Insert 5k entities in a single update call, repeat until instruction limit is reached.
export async function sib() {
    const simple = createActor(canisterIds.sib.local, { agentOptions: { host: "http://127.0.0.1:8000" } });
    const watcher = new Watcher(simple);
    const writerI = new Writer("./out/sib.csv");
    const writerIQ = new Writer("./out/sib_q.csv", true);
    const writerIS = new Writer("./out/sib_s.csv", true);
    if (writerI.fileExists()) {
        console.log(`Skipped Insertion Benchmark (Small) (Batch).`);
        return;
    }
    writerI.writeHeader(); writerIQ.writeHeader(); writerIS.writeHeader();
    console.log(`Started Insertion Benchmark (Small) (Batch).`);

    let i = 0, instructionLimit = false;
    while (!instructionLimit) {
        const entities = createEntities(i, size, attributes);
        try {
            watcher.startTimer();
            const c = await simple.batchPut(entities);
            const s = await watcher.stopTimer();
            writerI.writeLine((i + 1) * size, s, c);

            watcher.startTimer();
            const cQ = await simple.get(entities[0].sk);
            const sQ = await watcher.stopTimer();
            writerIQ.writeLine((i + 1) * size, sQ, cQ);

            watcher.startTimer();
            const cS = await simple.scan(entities[0].sk, scanSize, createSK(i, 0), createSK(i, size - 1));
            const sS = await watcher.stopTimer();
            writerIS.writeLine((i + 1) * size, sS, cS);
        } catch (e) {
            console.log(`Error: ${e}`);
            instructionLimit = true;
        }
        if (i != 0 && i % 10 == 0) console.log(`sib: ${i}/* ${await simple.size()}`);
        i++;
    }
    console.log(`Finished Insertion Benchmark (Small) (Batch).`);
}

export async function sibQ() {
    const simple = createActor(canisterIds.sib.local, { agentOptions: { host: "http://127.0.0.1:8000" } });
    const watcher = new Watcher(simple);
    const writerIQ = new Writer("./out/sib_q.csv", true);
    const writerIS = new Writer("./out/sib_s.csv", true);
    if (writerIQ.fileExists()) {
        console.log(`Skipped Insertion Benchmark Query (Small) (Batch).`);
        return;
    }
    writerIQ.writeHeader(); writerIS.writeHeader();
    console.log(`Started Insertion Benchmark Query (Small) (Batch).`);

    let i = 0, instructionLimit = false;
    while (!instructionLimit) {
        const entities = createEntities(i, size, attributes);
        try {
            await simple.batchPut(entities);

            watcher.startTimer();
            const cQ = await simple.get(entities[0].sk);
            const sQ = await watcher.stopTimer();
            writerIQ.writeLine((i + 1) * size, sQ, cQ);

            watcher.startTimer();
            const cS = await simple.scan(entities[0].sk, scanSize, createSK(i, 0), createSK(i, size - 1));
            const sS = await watcher.stopTimer();
            writerIS.writeLine((i + 1) * size, sS, cS);
        } catch (e) {
            console.log(`Error: ${e}`);
            instructionLimit = true;
        }
        if (i != 0 && i % 10 == 0) console.log(`sib_q: ${i}/* ${await simple.size()}`);
        i++;
    }
    console.log(`Finished Insertion Benchmark Query (Small) (Batch).`);
}

// Start at 0. At each batch insertion “checkpoint” (0, 5k, 10k, etc.) insert 1 more item, then remaining 4_999.
export async function siud1() {
    const simple = createActor(canisterIds.siud1.local, { agentOptions: { host: "http://127.0.0.1:8000" } });
    const watcher = new Watcher(simple);
    const writerI = new Writer("./out/si1.csv");
    const writerU = new Writer("./out/su1.csv");
    const writerD = new Writer("./out/sd1.csv");
    if (writerI.fileExists() && writerU.fileExists() && writerD.fileExists()) {
        console.log(`Skipped Insertion/Update/Delete Benchmark (Small) (1): ${writerI.path} ${writerU.path} ${writerD.path}`);
        return;
    }
    writerI.writeHeader(); writerU.writeHeader(); writerD.writeHeader();
    console.log(`Started Insertion/Update Benchmark (Small) (1): ${writerI.path} ${writerU.path} ${writerD.path}`);

    let i = 0, instructionLimit = false;
    while (!instructionLimit) {
        const entities = createEntities(i, size, attributes);
        try {
            watcher.startTimer();
            const cI = await simple.put(entities[0]);
            const sI = await watcher.stopTimer();
            writerI.writeLine(i * size + 1, sI, cI);

            watcher.startTimer();
            const cU = await simple.put(entities[0]);
            const sU = await watcher.stopTimer();
            writerU.writeLine(i * size + 1, sU, cU);

            watcher.startTimer();
            const cD = await simple.delete(entities[0].sk);
            const sD = await watcher.stopTimer();
            writerD.writeLine(i * size + 1, sD, cD);

            await simple.batchPut(entities);
        } catch (e) {
            console.log(`Error: ${e}`);
            instructionLimit = true;
        }
        if (i != 0 && i % 10 == 0) console.log(`siud1: ${i}/* ${await simple.size()}`);
        i++;
    }
    console.log(`Finished Insertion/Update Benchmark (Small) (1): ${writerI.path} ${writerU.path} ${writerD.path}`);
}

// Start at 0. At each batch insertion “checkpoint” (0, 5k, 10k, etc.) make 100 calls in parallel
// (using Promise.all()) where each call inserts a single entity to CanDB, then remaining 4_900.
// Start at 0. At each batch insertion “checkpoint” (0, 5k, 10k, etc.) insert 1 more item, then remaining 4_999.
export async function sip() {
    const simple = createActor(canisterIds.sip.local, { agentOptions: { host: "http://127.0.0.1:8000" } });
    const watcher = new Watcher(simple), writer = new Writer("./out/sip.csv");
    if (writer.fileExists()) {
        console.log(`Skipped Insertion Benchmark (Small) (Parallel): ${writer.path}`);
        return;
    }
    writer.writeHeader();
    console.log(`Started Insertion Benchmark (Small) (Parallel): ${writer.path}`);

    let i = 0, instructionLimit = false;
    while (!instructionLimit) {
        const entities = createEntities(i, size, attributes);
        try {
            watcher.startTimer();
            const cs = await Promise.all(entities.slice(0, 100).map(async (entity) => await simple.put(entity)));
            const s = await watcher.stopTimer();
            // NOTE: c is the average number of instructions per call.
            const c = cs.reduce((a, b) => a + b, 0n) / BigInt(cs.length);
            writer.writeLine(i * size + 1, s, c);

            await simple.batchPut(entities.slice(100));
        } catch (e) {
            console.log(`Error: ${e}`);
            instructionLimit = true;
        }
        if (i != 0 && i % 10 == 0) console.log(`sip: ${i}/* ${await simple.size()}`);
        i++;
    }
    console.log(`Finished Insertion Benchmark (Small) (Parallel): ${writer.path}`);
}
