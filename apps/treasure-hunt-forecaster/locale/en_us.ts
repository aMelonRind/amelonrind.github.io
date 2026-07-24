export const en_us = {
  "site": {
    "title": "Blue Archive Treasure Hunt Forecaster",
    "description": {
      "main": "Get ALL possibilities of treasure hunt combinations.",
      "yap": [
        "Note that this tool explores all possibilities and treat them all equally, which might be inaccurate.",
        "The main difference compared to other tool is that this one doesn't do random sampling, it counts and shows all combinations.",
        "The theoretically best way of solving this event is having someone host a database that collects solved pattern from worldwide senseis, because it seems like they're not fully random generated. Noticed it when there's multiple same pattern in a chat group i'm in. Could it be picked by BA devs? idk.."
      ]
    }
  },
  "preset": {
    "placeholder": "Apply a preset...",
    "stage": "Stage {{ stage }}",
    "stageLast": "Stage {{ stage }}+"
  },
  "hover": {
    "empty": "\u00A0",
    "hoverToSee": "Hover an element to see description",
    "clickToPlace": "Click to place item\u00A0{{ item }}",
    "clickToPlaceHori": "Click to place item\u00A0{{ item }} horizontally",
    "clickToPlaceVert": "Click to place item\u00A0{{ item }} vertically",
    "placementOOB": "Placement out of bounds",
    "placementOccupied": "Placement occupied",
    "clickToRemoveItem": "Click to remove placement",
    "somethingWrongInInv": "Something wrong happened in the inventory data..",
    "clickToMarkOpen": "Click to mark index\u00A0{{ index }} as opened",
    "clickToMarkClose": "Click to mark index\u00A0{{ index }} as not\u00A0opened",
    "slotStat": " | Counts:\u00A0[{{ counts }}], Sum:\u00A0{{ sum }}, Percentage:\u00A0{{ perc }}%",
    "slotStatPartialVisible": " | Counts:\u00A0[{{ counts }}], Sum:\u00A0{{ sum }}, Visible:\u00A0{{ visible }}, Percentage:\u00A0{{ perc }}%",
    "invalid1x1": "Size\u00A01x1 is invalid",
    "setItemSize": "Set size to {{ width }}x{{ height }} for item\u00A0{{ item }}",
    "setItemCount": "Set count to {{ count }} for item\u00A0{{ item }}",
    "enableItemVisibility": "Enable visibility for item\u00A0{{ item }}",
    "disableItemVisibility": "Disable visibility for item\u00A0{{ item }}",
    "addItemPlacement": "Add placement for item\u00A0{{ item }}",
    "addItemPlacementHori": "Add horizontal placement for item\u00A0{{ item }}",
    "addItemPlacementVert": "Add vertical placement for item\u00A0{{ item }}",
    "itemPlacementFull": "Placement for item\u00A0{{ item }} are already satisfied ({{ count }})",
    "running": "Running",
    "runningCanRestart": "Running, click to restart with current state",
    "runningElapsed": " | Elapsed:\u00A0{{ elapsedSec }}s",
    "clickToStart": "Click to start",
    "totalPossibilities": "Total\u00A0possibilities:\u00A0{{ total }}, Took\u00A0time:\u00A0{{ time }}ms",
    "totalPossibilities1": "Total\u00A0possibilities:\u00A01"
  }
} as const;
