export const en_us = {
  "site": {
    "title": "Mapart\u00a0Converter",
    "description": "Effortlessly convert your Minecraft mapart related files between formats."
  },
  "status": {
    "import_guide": "Drag 'n' drop or paste to import...\nAccepts images/.nbt/.schematic/.litematic/map_*.dat/.zip",
    "image_info": "{{ imgWidth }}x{{ imgHeight }} ({{ mapWidth }}x{{ mapHeight }}) • {{ imgType }}"
  },
  "control": {
    "rebane_url_input": "Rebane palette url: ",
    "rebane_url_tooltip": "The link of shared blocks generated from rebane2001's MapartCraft.",
    "download_png": "Download as PNG",
    "download_png_tooltip": "Automatically names the file if available.\nWhen in BlockImage, saves as indexed png with highest compression level.\nSo it might take some time on large image.",
    "convert": {
      "order": "{<convert>}by{<method>}",
      "button": "Convert",
      "tooltip": "For normal dither types, go to Rebane's MapartCraft because they're more advanced.\nThis site is mainly for special image types.\nAfter converting from there, copy the image and then use \"nearest\" convert type here.",
      "method": {
        "nearest": {
          "name": "Nearest",
          "title": "Convert Method: Nearest",
          "description": "Convert each pixel to their nearest color in mapart palette using rmean algorithm."
        },
        "rebane_2d_restore": {
          "name": "Restore from Rebane 2d view",
          "title": "Convert Method: Restore from Rebane's MapartCraft 2d view",
          "description": "Restores the mapart from the 2d view image. Example:",
          "33": {
            "title": "Not a multiply of 33",
            "description": "{{ imgWidth }}x{{ imgHeight }} ({{ mapWidth }}x{{ mapHeight }})"
          },
          "not_fully_restored": {
            "title": "Not Fully Restored",
            "description": "The converter was unable to restore some pixels. They're left with transparent. The pixels below them are probably affected too. ({{ missing }}/{{ size }})\u0020({{ percentage }}%)"
          }
        }
      }
    },
    "export": {
      "order": "{<export>}as{<format>}",
      "button": "Export"
    }
  },
  "undefined_alert": {
    "convert_method": "Undefined convert method ({{ method }})",
    "export_method": "Undefined export method ({{ method }})"
  },
  "form": {
    "invalid_4th_color": {
      "title": "Invalid Color",
      "description": "The image contains invalid darkest color for survival structures.\nDo you want to convert them to corresponding dark varient and continue exporting?"
    },
    "invalid_dark_top": {
      "title": "Dark Under Transparent",
      "description": "The image contains troublesome dark color under transparent pixels.",
      "checkbox": {
        "label": "Convert To Light Varient",
        "tooltip": "Unchecking this will generate scaffolding placeholder for you to process these colors manually."
      }
    }
  }
} as const;
