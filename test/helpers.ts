
import { Page } from 'playwright';

let page: Page;

async function openExampleFile(page: Page){
    await page.locator('#navBarFile').click()
    // deal with debounce timer
    await page.waitForTimeout(300);
    await page.locator('#open-file').click()
    await page.locator('#spectrogramWrapper').waitFor({state: 'visible'})
  }
  
  async function changeSettings(page: Page, type: string, elementID: string, value: any, timeout: number){
    elementID = '#' + elementID;
    await  page.locator('#navbarSettings').click();
    // for Birdnet's 34%$
    await page.locator('#confidence').fill('30');
    if (type === 'select'){
      await page.selectOption(elementID, value);
    } else if (type === 'switch'){
      await page.locator(elementID).setChecked(value);
    }  else {
      await page.locator(elementID).fill(value);
    }
    // deal with debounce timer
    await page.waitForTimeout(300);
    await page.locator('#close-settings').click();
    // Wait ?
    if (timeout) await page.waitForTimeout(timeout);
  }
  
  async function runExampleAnalysis(page: Page, model: string){
    await openExampleFile(page)
    await changeSettings(page,'select', 'model-to-use', model, 2000)
  
    await  page.locator('#navbarAnalysis').click()
    // deal with debounce timer
    await page.waitForTimeout(300);
    await page.locator('#analyse').click()
    await page.locator('div.show > div.toast-header').waitFor({
      state: 'visible',
      timeout: 60000 // Wait up to 60 seconds for the toast header to become visible
    });
    await  page.locator('#resultTableContainer').waitFor({state: 'visible'})
  }

  export {changeSettings, openExampleFile, runExampleAnalysis}