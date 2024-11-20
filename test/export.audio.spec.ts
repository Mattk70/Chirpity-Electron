import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';
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
} from 'electron-playwright-helpers';
import { ElectronApplication, Page } from 'playwright';
import {changeSettings, openExampleFile, runExampleAnalysis} from './helpers';
//import {Jimp} from 'jimp';

let electronApp: ElectronApplication;
let page: Page;
let worker: Page;
let example_file: any

test.beforeAll(async () => {
  // find the latest build in the out directory
  const latestBuild = findLatestBuild('./dist')
  // parse the directory and find paths and other info
  const appInfo = parseElectronApp(latestBuild)
  // set the CI environment variable to true
  process.env.CI = 'e2e';
  electronApp = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable,
    env: {
      ...process.env,
      TEST_ENV: 'true'
    }

  })

  // Get the path for the example file we want to load
  example_file = await ipcMainInvokeHandler(electronApp, 'getAudio')
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
   worker = await electronApp.firstWindow()

  electronApp.on('window', async (window) => {
    const filename = window.url()?.split('/').pop()
    console.log(`Window opened: ${filename}`)
    page = window;
    page.on('pageerror', (error) => {
      console.error(error)
    })
    // capture console messages
    page.on('console', (msg) => {
      console.log(msg.text())
    })
  })
  await new Promise((resolve) => { 
    const checkPage = setInterval(async () => { 
      if (page) { 
        clearInterval(checkPage);
        resolve('');
      } 
    }, 5000); 
  });
})

test.afterAll(async () => {
  //await page.pause()
  await electronApp.close()
})

//test.describe.configure({ mode: 'parallel', retries: 2, timeout: 20_000 });

/*
REMEMBER TO REBUILD THE APP IF THE *APPLICATION CODE* NEEDS TO BE CHANGED
                                    ----------------
*/


// test('Export mp3 works', async () => {
//     await runExampleAnalysis(page,'chirpity');
//     await changeSettings(page, 'select', 'format', 'mp3', 0)
//     await page.locator('region').click({button: 'right'});
//     await page.locator('#context-create-clip').click();

// })

test('Can create/edit a manual record', async () => {
  await runExampleAnalysis(page,'chirpity');
  await page.locator('#result1').click();
  await page.locator('region').click({button: 'right'});
  await page.locator('#create-manual-record').click();
  const birdList = page.locator('#bird-list-all');
  // @ts-ignore
  const selectedValue = await birdList.evaluate(select => select.value);
  // The edit form has the current species selected
  expect(selectedValue === 'Redwing (call)' )
  await birdList.selectOption('Ring Ouzel (call)');
  await page.locator('#call-count').fill('3');
  await page.locator('#record-comment').fill('a test comment');
  await page.locator('#record-add').click();
  const cname = await page.locator('#result1 td.cname > span.material-symbols-outlined')
  const confidence = await cname.textContent();
  // Confidence has a checkmark
  expect(confidence).toBe('verified');
  const comment =  await (await page.locator('#result1  td.comment  span')).getAttribute('title');
  // Comment saved
  expect(comment).toBe('a test comment');
  const callCount = await page.locator('#call-count').inputValue();
  // Call count updated
  expect(callCount).toBe('3');
  await page.keyboard.press('ControlOrMeta+s');
  await page.waitForTimeout(1000);
  const filename = await page.locator('#filename span.filename');
  // File name is blue - saved
  const hasClass = await filename.evaluate(el => el.classList.contains('text-info'));
  expect(hasClass).toBe(true)
})

// test(`Nocmig analyse works and second result is 61%`, async () => {
//   await runExampleAnalysis(page,'chirpity');
//   const callID = page.locator('#speciesFilter').getByText('Redwing (call)');
//   expect(callID).not.toBe(undefined)
//   const secondResult = await (await page.waitForSelector('#result2 span.confidence-row > span')).textContent()
//   // console.log(secondResult, 'second result');
//   expect(secondResult).toBe('61%');
// })

// test(`BirdNET analyse works and second result is 34%`, async () => {
//   await runExampleAnalysis(page, 'birdnet');
//   const callID = page.locator('#speciesFilter').getByText('Redwing (call)');
//   expect(callID).not.toBe(undefined)
//   const secondResult = await (await page.waitForSelector('#result2 span.confidence-row > span')).textContent()
//   // console.log(secondResult, 'second result');
//   expect(secondResult).toBe('34%');
// })




// test("Amend file start dialog contains date", async () =>{
//   await runExampleAnalysis(page, 'chirpity');
//   await page.locator('#dropdownMenuButton').click({button: 'right'});
//   await page.locator('#setFileStart').click();
//   const fileStart = await page.locator('#fileStart');
//   const entry = await fileStart.inputValue();
//   const currentYear = new Date().getFullYear().toString();
//   expect(entry.toString()).toContain(currentYear);
//   // await page.locator('#spectrogramWrapper button.btn-secondary').click();
// })


