import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';
import { 
  findLatestBuild, 
  // ipcMainCallFirstListener, 
  // ipcRendererCallFirstListener, 
  parseElectronApp,
  ipcMainInvokeHandler,
  // ipcRendererInvoke,
  // ipcRendererSend,
  // ipcMainEmit,
  stubMultipleDialogs
} from 'electron-playwright-helpers';
import { ElectronApplication, Page } from 'playwright';
import {runExampleAnalysis} from './helpers';
//import {Jimp} from 'jimp';

let electronApp: ElectronApplication;
let page: Page;
let _worker: Page;
let example_file: any
// find the latest build in the out directory
const latestBuild = findLatestBuild('./dist')
// parse the directory and find paths and other info
const appInfo = parseElectronApp(latestBuild)
// set the CI environment variable to true
process.env.CI = 'e2e';

test.beforeAll(async () => {

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
   _worker = await electronApp.firstWindow()

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
    }, 100); 
  });
})

test.afterAll(async () => {
  //await page.pause()
  console.log('in after all')
  await electronApp.close()
  console.log(' app closed')
})


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
  console.log('starting record creation test')
  await runExampleAnalysis(page,'chirpity');
  await page.locator('#result1').click();
  await page.locator('region').click({button: 'right'});
  await page.locator('#create-manual-record').click();
  const birdList = page.locator('#bird-list-all');
  // @ts-ignore
  const selectedValue = await birdList.evaluate(select => select.value);
  // The edit form has the current species selected
  console.log('record creation test: before first expect')
  expect(selectedValue === 'Redwing (call)' )
  await birdList.selectOption('Ring Ouzel (call)');
  await page.locator('#call-count').fill('3');
  await page.locator('#record-comment').fill('a test comment');
  await page.locator('#record-add').click();
  const cname = await page.locator('#result1 td.cname > span.material-symbols-outlined')
  const confidence = await cname.textContent();
  // Confidence has a checkmark

  console.log('record creation test: before second expect')
  expect(confidence).toBe('verified');
  const comment =  await (await page.locator('#result1  td.comment  span')).getAttribute('title');
  // Comment saved

  console.log('record creation test: before 3rd expect')
  expect(comment).toBe('a test comment');
  const callCount = await page.locator('#call-count').inputValue();
  // Call count updated

  console.log('record creation test: before 4th expect')
  expect(callCount).toBe('3');
  await page.keyboard.press('ControlOrMeta+s');
  // await page.waitForTimeout(1000);
  // const filename = await page.locator('#filename span.filename');
  // File name is blue - saved
  // const hasClass = await filename.evaluate(el => el.classList.contains('text-info'));
  await page.evaluate(
    ({selector, className}) => {
      const element = document.querySelector(selector);
      return element && element.classList.contains(className);
    },
    { timeout: 5000, // Adjust timeout as needed
    selector: '#filename span.filename', // Selector
    className: 'text-info'} // Class to wait for
  );

  console.log('record creation test: complete')
})



