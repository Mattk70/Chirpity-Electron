import { _electron as electron } from 'playwright'
import { test, expect } from '@playwright/test'
import { 
  findLatestBuild, 
  ipcMainCallFirstListener, 
  ipcRendererCallFirstListener, 
  parseElectronApp,
  ipcMainInvokeHandler,
  ipcRendererInvoke,
  ipcRendererSend,
  ipcMainEmit,
  stubMultipleDialogs
} from 'electron-playwright-helpers'
import { ElectronApplication, Page } from 'playwright'
import jimp from 'jimp'
import { ipcMain } from 'electron'
let electronApp: ElectronApplication
let page: Page
let worker: Page
let example_file: any

test.beforeAll(async () => {
  // find the latest build in the out directory
  const latestBuild = findLatestBuild('./dist')
  // parse the directory and find paths and other info
  const appInfo = parseElectronApp(latestBuild)
  // set the CI environment variable to true
  process.env.CI = 'e2e'
  electronApp = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable
  })

  example_file = await ipcMainInvokeHandler(electronApp, 'getAudio')
  console.log('Example file:' , example_file)
  await stubMultipleDialogs(electronApp, [
    {
      method: 'showOpenDialog',
      value: {
        filePaths: [example_file],
        canceled: false,
      },
    },
    {
       method: 'showSaveDialog',
       value: {
         filePath: '/path/to/file',
         canceled: false,
       },
     },
   ])

  worker = await electronApp.firstWindow();

  electronApp.on('window', async (window) => {
    const filename = window.url()?.split('/').pop()
    console.log(`Window opened: ${filename}`)
    page = window
    // capture errors
    page.on('pageerror', (error) => {
      console.error(error)
    })
    // capture console messages
    page.on('console', (msg) => {
      console.log(msg.text())
    })
  })

})

test.afterAll(async () => {
  await electronApp.close()
})

test('Page title is correct', async () => {
  page = await electronApp.waitForEvent('window')

  page.pause()
  const title = await page.title()
  expect(title).toBe('Chirpity Bird Call Detection')
})


test(`"Open File" works`, async () => {
  const fileMenu = await page.$('#navbarDropdown')
  await fileMenu?.click()
  const fileOpen = await page.$('#open')
  expect(fileOpen).toBeTruthy()
  await fileOpen?.click();
  const fileName = await page.$('#spectrogram') 
  expect(fileName).toBeTruthy() 
  await page.screenshot({ path: 'intro.png' })
  
})


// test('send IPC message from renderer', async () => {
//   // evaluate this script in render process
//   // requires webPreferences.nodeIntegration true and contextIsolation false
//   await page.evaluate(() => {
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     require('electron').ipcRenderer.send('new-window')
//   })
//   const newPage = await electronApp.waitForEvent('window')
//   expect(newPage).toBeTruthy()
//   expect(await newPage.title()).toBe('Window 4')
//   page = newPage
// })

// test('receive IPC invoke/handle via renderer', async () => {
//   // evaluate this script in RENDERER process and collect the result
//   const result = await ipcRendererInvoke(page, 'how-many-windows')
//   expect(result).toBe(4)
// })

// test('receive IPC handle data via main', async () => {
//   // evaluate this script in MAIN process and collect the result
//   const result = await ipcMainInvokeHandler(electronApp, 'openFiles')
//   expect(result).toBe(4)
// })

// test('receive synchronous data via ipcRendererCallFirstListener()', async () => {
//   const data = await ipcRendererCallFirstListener(page, 'get-synchronous-data')
//   expect(data).toBe('Synchronous Data')
// })

// test('receive asynchronous data via ipcRendererCallFirstListener()', async () => {
//   const data = await ipcRendererCallFirstListener(page, 'get-asynchronous-data')
//   expect(data).toBe('Asynchronous Data')
// })

// test('receive synchronous data via ipcMainCallFirstListener()', async () => {
//   const data = await ipcMainCallFirstListener(electronApp, 'main-synchronous-data')
//   expect(data).toBe('Main Synchronous Data')
// })

// test('receive asynchronous data via ipcMainCallFirstListener()', async () => {
//   const data = await ipcMainCallFirstListener(electronApp, 'main-asynchronous-data')
//   expect(data).toBe('Main Asynchronous Data')
// })

// test('select a menu item via the main process', async () => {
//   await clickMenuItemById(electronApp, 'new-window')
//   const newPage = await electronApp.waitForEvent('window')
//   expect(newPage).toBeTruthy()
//   expect(await newPage.title()).toBe('Window 5')
//   page = newPage
// })

test('make sure two screenshots of the same page match', async () => {
  // take a screenshot of the current page
  const screenshot1: Buffer = await page.screenshot()
  // create a visual hash using Jimp
  const screenshot1hash = (await jimp.read(screenshot1)).hash()
  // take a screenshot of the page
  const screenshot2: Buffer = await page.screenshot()
  // create a visual hash using Jimp
  const screenshot2hash = (await jimp.read(screenshot2)).hash()
  // compare the two hashes
  expect(screenshot1hash).toEqual(screenshot2hash)
})

