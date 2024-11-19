//@ts-check
/// <reference path = "../index.d.ts"/>

const exportOptions = (() => {
  return {
    async '.litematic'(image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toLitematic()
      downloadBlob(name, data)
    },
    async '.nbt'(image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toStructure()
      downloadBlob(name, data)
    },
    async '.dat / zip of .dat'(image = getBlockImage()) {
      if (!image) return
      const split = image.split1x1()
      if (split.length === 1) {
        const { name, data } = await split[0].toDat()
        downloadBlob(name, data)
      } else {
        packAndDownloadZip(image, split, img => img.toDat())
      }
    },
    async 'zip of 1x1 .litematic'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.split1x1(), img => img.toLitematic())
    },
    async 'zip of 1x1 .nbt'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.split1x1(), img => img.toStructure())
    },
    async 'zip of rows of .litematic'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.splitRows(), img => img.toLitematic())
    },
    async 'zip of rows of .nbt'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.splitRows(), img => img.toStructure())
    },
    async '.litematic with separated materials'(image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toLitematicSeparated()
      downloadBlob(name, data)
    },
    async 'zip of 1x1 .litematic with separated materials'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.split1x1(), img => img.toLitematicSeparated())
    },
    async 'zip of rows of .litematic with separated materials'(image = getBlockImage()) {
      if (!image) return
      packAndDownloadZip(image, image.splitRows(), img => img.toLitematicSeparated())
    },
  }

  function getBlockImage() {
    const ctx = MainContext.getCurrent()
    if (!ctx) {
      alert('no context active')
      return null
    }
    if (ctx.base instanceof BlockImage) {
      return ctx.base
    } else {
      alert('data is not BlockImage')
      return null
    }
  }

  /**
   * @param {BlockImage} image 
   * @param {BlockImage[]} split 
   * @param {(img: BlockImage) => PromiseLike<NbtDataResult>} builder 
   */
  async function packAndDownloadZip(image, split, builder) {
    const zip = new JSZip()
    await Promise.all(split.map(async image => {
      const { name, data } = await builder(image)
      zip.file(name, data, { binary: true })
    }))
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(`${image.filename}.zip`, blob)
  }
})()
