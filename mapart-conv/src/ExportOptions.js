//@ts-check
/// <reference path = "../index.d.ts"/>

/** @type {Record<string, (task?: ITask, image?: BlockImage?) => Promise<any>>} */
const exportOptions = (() => {
  return {
    async '.litematic'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toLitematic(task)
      downloadBlob(name, data)
    },
    async '.nbt'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toStructure(task)
      downloadBlob(name, data)
    },
    async '.dat / zip of .dat'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const split = image.split1x1()
      if (split.length === 1) {
        const { name, data } = await split[0].toDat()
        downloadBlob(name, data)
      } else {
        await packAndDownloadZip(image, split, img => img.toDat(), task)
      }
    },
    async 'zip of 1x1 .litematic'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      await packAndDownloadZip(image, image.split1x1(), (img, task) => img.toLitematic(task), task)
    },
    async 'zip of 1x1 .nbt'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      await packAndDownloadZip(image, image.split1x1(), (img, task) => img.toStructure(task), task)
    },
    async 'zip of rows of .litematic'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      await packAndDownloadZip(image, image.splitRows(), (img, task) => img.toLitematic(task), task)
    },
    async 'zip of rows of .nbt'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      await packAndDownloadZip(image, image.splitRows(), (img, task) => img.toStructure(task), task)
    },
  }

  function getBlockImage() {
    const ctx = MainContext.getCurrent()
    if (!ctx) {
      alert('No context active.')
      return null
    }
    if (ctx.base instanceof BlockImage) {
      return ctx.base
    } else {
      alert('The data should be BlockImage in order to get exported.')
      return null
    }
  }

  /**
   * @param {BlockImage} image 
   * @param {BlockImage[]} split 
   * @param {(img: BlockImage, task: ITask) => PromiseLike<NbtDataResult>} builder 
   */
  async function packAndDownloadZip(image, split, builder, task = ITask.DUMMY) {
    const zip = new JSZip()
    await task.push('Generating zip file', 2)
    await task.force().push('Building zip contents', split.length)
    for (const image of split) {
      await task.progress()
      const { name, data } = await builder(image, task)
      zip.file(name, data, { binary: true })
    }
    task.pop()
    await task.force().swap('Generating blob')
    const blob = await zip.generateAsync({ type: 'blob' })
    task.pop()
    downloadBlob(`${image.filename}.zip`, blob)
  }
})()
