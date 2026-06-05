import { downloadBlob } from "../../../lib/util.ts";
import { NbtDataResult } from "../../types.ts";
import BlockImage from "./BlockImage.ts";
import MainContext from "./MainContext.ts";
import { ITask } from "./TaskManager.ts";
import JSZip from "jszip";

const exportOptions: Record<string, (task?: ITask, image?: BlockImage | null) => Promise<any>> = (() => {
  return {
    async '.litematic'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toLitematic(task)
      downloadBlob(name, Uint8Array.from(data))
    },
    async '.nbt'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const { name, data } = await image.toStructure(task)
      downloadBlob(name, Uint8Array.from(data))
    },
    async '.dat / zip of .dat'(task = ITask.DUMMY, image = getBlockImage()) {
      if (!image) return
      const split = image.split1x1()
      if (split.length === 1) {
        const { name, data } = await split[0].toDat()
        downloadBlob(name, Uint8Array.from(data))
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

  async function packAndDownloadZip(
    image: BlockImage,
    split: BlockImage[],
    builder: (img: BlockImage, task: ITask) => PromiseLike<NbtDataResult>,
    task = ITask.DUMMY
  ) {
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

export default exportOptions
