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
    // Wait for the model to be ready
    const warmup = page.locator('#warmup')
    const slowExpect = expect.configure({ timeout: 15_000 });
    await slowExpect(warmup).toHaveClass('dropdown-item text-danger d-none') 
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
  //await page.pause()
  await electronApp.close()
})


test('Page title is correct', async () => {
  page = await electronApp.waitForEvent('window')
  const title = await page.title()
  expect(title).toBe('Chirpity Bird Call Detection')
})


test(`Analyse works`, async () => {
  await page.locator('#navbarDropdown').click()
  await page.locator('#open').click()
  page.locator('wave').first().waitFor({state: 'visible'})
  await  page.locator('#navbarAnalysis').click()
  await page.locator('#analyse').click()
  await  page.locator('#resultTableContainer').waitFor({state: 'visible'})
  const callID = page.locator('#speciesFilter').getByText('Redwing (call)');
  expect(callID).not.toBe(undefined)
})

//test.describe.configure({ mode: 'parallel' });

test(`Audacity labels work`, async () => {
  // Everything shows 8 rows @ 45%
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Show:').selectOption('everything');
  await page.waitForFunction(() => donePredicting());
  const labels = await page.evaluate(() => getAudacityLabels());
  expect(labels.length).toBe(8);
  // nocturnal shows 2 rows @ 45%
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Show:').selectOption('NOCTURNAL');
  await page.waitForFunction(() => donePredicting());
  const labels2 = await page.evaluate(() => getAudacityLabels());
  expect(labels2.length).toBe(2);
  expect(labels2[0].cname).toBe("Redwing (call)")
  // reset the list to default
  await page.evaluate(() => {
    config.list = 'nocturnal'
  })
})

test("Amend file start dialog contains date", async () =>{
  await page.getByRole('button', { name: 'example.mp3' }).click({
    button: 'right'
  });
  await page.getByText('edit_calendar Amend File Start Time').click();
  const fileStart = page.locator('#fileStart')
  expect(fileStart).toHaveValue('2023-09-23T08:56')
  await page.getByRole('button', { name: 'Cancel' }).click();
})

test('Check spectrogram before and after applying filter are different', async () => {
  // take a screenshot of the current page
  const screenshot1: Buffer = await page.screenshot()
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Low Shelf filter:').fill('1200');
  await page.getByLabel('Attenuation:').fill('18');
  await page.getByText('blur_on').click();
  await page.getByRole('button', { name: 'Settings' }).isHidden();
  await page.waitForFunction(() => getFileLoaded());
  // take a screenshot of the page after filter applied
  const screenshot2: Buffer = await page.screenshot()
  // compare the two images
  const different = jimp.diff(await jimp.read(screenshot1), await jimp.read(screenshot2), 0.001)
  expect(different.percent).toBeGreaterThan(0)
  // Reset blur
  await page.getByText('blur_on').click();
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


