export const en_us = {
  "site": {
    "title": "Corner\u00a0Cutter",
    "description": "Save building materials by removing non visible blocks in minecraft buildings. Let the tool check connection for you by defining outside and inside."
  },
  "direction": {
    "up": "Up",
    "down": "Down",
    "north": "North",
    "south": "South",
    "west": "West",
    "east": "East"
  },
  "input": {
    "file": {
      "desc": "Accepts litematic file with exactly one region. You can also drag'n'drop or paste to import them.",
      "get": "Get Litematica mod here",
      "time": "The import time of the file"
    },
    "outside_directions": {
      "label": "Outsides:",
      "desc": "Choose which sides should be treated as outside. At least one direction or marker should be defined."
    },
    "inside_marker": {
      "label": "Inside Marker:",
      "desc": "Set which block should be treated as inside (unreachable). If outsides found a path to reach this marker, a litematic will be generated to assist patching the hole."
    },
    "outside_marker": {
      "label": "Outside Marker:",
      "desc": "Set which block should be treated as outside."
    },
    "extra_solid_blocks": {
      "label": "Extra Solid Blocks:",
      "desc": "Adds extra solid blocks in case it's modded or this site's data is outdated. Can be ids separated by commas or a valid json of array of strings. \"minecraft:\" namespace can be omitted."
    },
    "recursive": {
      "label": "Recursive:",
      "desc": "If connections to inside marker are found, attempts to patch them and then rescan."
    },
    "auto_start": {
      "label": "Auto Start:",
      "desc": "Automatically start upon received new file."
    },
    "start": {
      "label": "Start",
      "desc": "Starts scan with the given inputs."
    },
    "main_mask": {
      "label": "Main Mask:",
      "desc": "The main mask block for exporting litematic."
    },
    "suppport_mask": {
      "label": "Support Mask:",
      "desc": "The support mask block for blocks under fallable block like sand or concrete powder."
    },
    "auto_download": {
      "label": "Auto Download:",
      "desc": "Automatically download whenever it's ready."
    },
    "download": {
      "label": "Download",
      "desc": "Downloads the result."
    }
  },
  "error": {
    "label": "Error occurred:",
    "no_file": "No file selected.",
    "no_read": "No litematic file detected.",
    "same_marker": "Inside Marker and Outside Marker cannot be the same!",
    "undefined_outside": "No outside specified. Every block would be marked as removal.",
    "file_type": "This tool only accepts litematic file. Received {{ name }}.",
    "no_region": "No region found.",
    "multiple_region": "Multiple regions is not supported. Please re-save the litematic with only one region.",
    "esb": {
      "not_array": "Failed to parse Extra Solid Blocks: Not an array.",
      "not_string_array": "Failed to parse Extra Solid Blocks: Not a string array.",
      "other": "Failed to parse Extra Solid Blocks: {{ error }}"
    }
  },
  "status": {
    "idle": "Idle",
    "starting": "Starting...",
    "init": "Initializing...",
    "scanning": "Scanning...",
    "finalizing": "Finalizing...",
    "result": "Completed."
  },
  "running": {
    "alives": "Alive cells: {{ alives }}",
    "recursive": "Running recursively #{{ runs }}"
  },
  "result": {
    "redstone": "Redstone component detected. Make sure to check them manually!",
    "saves": "This mask can help you save:",
    "perfect": "This litematic is already perfect for this tool! (No blocks detected for removal)",
    "detected_patches": "Inside Marker detected. Generating patches.",
    "detected_paths": "Inside Marker detected. Generating paths."
  }
} as const;
