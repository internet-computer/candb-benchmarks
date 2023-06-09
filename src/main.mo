import Prim "mo:⛔";

import CanDB "mo:candb/CanDB";
import Entity "mo:candb/Entity";
import Nat64 "mo:base/Nat64";

actor {
  public shared func scale(t : Text) : async Text { t };
  private let initArgs : CanDB.DBInitOptions = {
    pk = "pk";
    scalingOptions = {
      autoScalingHook = scale;
      sizeLimit = #count(999_000_000_000);
    };
    btreeOrder = null;
  };

  stable var db = CanDB.init(initArgs);

  type ConsumableEntity = {
    sk : Entity.SK;
    attributes : [(Entity.AttributeKey, Entity.AttributeValue)];
  };

  public shared func delete(sk : Entity.SK) : async Nat64 {
    countSync(func() = CanDB.delete(db, { sk }));
  };

  public query func get(sk : Entity.SK) : async Nat64 {
    countSync(func () = ignore CanDB.get(db, { sk }));
  };

  public query func scan(sk : Entity.SK, limit : Nat, skLowerBound : Entity.SK, skUpperBound : Entity.SK) : async Nat64 {
    countSync(func () = ignore CanDB.scan(db, { ascending = null; limit; skLowerBound; skUpperBound }));
  };

  public shared func put(entity : ConsumableEntity) : async Nat64 {
    await* countAsync(func() : async* () { await* CanDB.put(db, entity) });
  };

  public shared func batchPut(entities : [ConsumableEntity]) : async Nat64 {
    await* countAsync(func() : async* () { await* CanDB.batchPut(db, entities) });
  };

  public query func size() : async Nat { db.count };

  public query func stats() : async (balance : Nat, heapSize : Nat) {
    (Prim.cyclesBalance(), Prim.rts_heap_size());
  };

  private func countSync(instr : () -> ()) : Nat64 {
    let init = Prim.performanceCounter(0);
    let pre = Prim.performanceCounter(0);
    instr();
    let post = Prim.performanceCounter(0);
    let overhead = pre - init; // Remove the overhead of the measurement.
    post - pre - overhead;
  };

  private func countAsync(instr : () -> async* ()) : async* Nat64 {
    let init = Prim.performanceCounter(0);
    let pre = Prim.performanceCounter(0);
    await* instr();
    let post = Prim.performanceCounter(0);
    let overhead = pre - init; // Remove the overhead of the measurement.
    post - pre - overhead;
  };

};
