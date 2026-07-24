// stores the actual combination existed in game

// an entry needs to store:
// their version, can be omitted if in a collection.
// creation time in unix time as leb128.u64.
// amount of item types.
// the items' width, height and amount.
// clicked slots that are empty as leb128.u64, can be 0 if all items are found.
// each item type's place amount and each placement locations, rotations, and if they're flipped.

export namespace inv_data {
  export const waitForData = new Promise<void>(res => {
    res()
  })
}
