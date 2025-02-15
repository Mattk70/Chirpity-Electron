/**
 * Updates the "from" slider and input fields based on parsed numeric values from the "from" and "to" inputs,
 * and visually refreshes the slider fill.
 *
 * This function retrieves the current numeric values from the provided "from" and "to" input elements using
 * the `getParsed` utility. It then calls `fillSlider` to update the slider's visual fill between a fixed
 * unselected color ("#C6C6C6") and a selected color ("#0d6efd"). If the parsed "from" value exceeds the "to"
 * value, it adjusts the "from" slider and input to match the "to" value to maintain a valid range. Otherwise,
 * it sets the "from" slider to the parsed "from" value.
 *
 * @param {HTMLInputElement} fromSlider - The slider element representing the starting ("from") value.
 * @param {HTMLInputElement} fromInput - The text input element corresponding to the "from" value.
 * @param {HTMLInputElement} toInput - The text input element corresponding to the ending ("to") value.
 * @param {Element} controlSlider - The DOM element used by `fillSlider` to update the slider's visual appearance.
 */

function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
  const [from, to] = getParsed(fromInput, toInput);
  fillSlider(fromInput, toInput, "#C6C6C6", "#0d6efd", controlSlider);
  if (from > to) {
    fromSlider.value = to;
    fromInput.value = to;
  } else {
    fromSlider.value = from;
  }
}

function controlToInput(toSlider, fromInput, toInput, controlSlider) {
  const [from, to] = getParsed(fromInput, toInput);
  fillSlider(fromInput, toInput, "#C6C6C6", "#0d6efd", controlSlider);
  setToggleAccessible(toInput);
  if (from <= to) {
    toSlider.value = to;
    toInput.value = to;
  } else {
    toInput.value = from;
  }
}

function controlFromSlider(fromSlider, toSlider, fromInput) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, "#C6C6C6", "#0d6efd", toSlider);
  if (from > to) {
    fromSlider.value = to;
    fromInput.value = to;
  } else {
    fromInput.value = from;
  }
}

function controlToSlider(fromSlider, toSlider, toInput) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, "#C6C6C6", "#0d6efd", toSlider);
  setToggleAccessible(toSlider);
  if (from <= to) {
    toSlider.value = to;
    toInput.value = to;
  } else {
    toInput.value = from;
    toSlider.value = from;
  }
}

function getParsed(currentFrom, currentTo) {
  const from = currentFrom.valueAsNumber;
  const to = currentTo.valueAsNumber;
  return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
  const rangeDistance = to.max - to.min;
  const fromPosition = from.value - to.min;
  const toPosition = to.value - to.min;
  controlSlider.style.background = `linear-gradient(
      to right,
      ${sliderColor} 0%,
      ${sliderColor} ${(fromPosition / rangeDistance) * 100}%,
      ${rangeColor} ${(fromPosition / rangeDistance) * 100}%,
      ${rangeColor} ${(toPosition / rangeDistance) * 100}%, 
      ${sliderColor} ${(toPosition / rangeDistance) * 100}%, 
      ${sliderColor} 100%)`;
}

function setToggleAccessible(currentTarget) {
  const toSlider = document.querySelector("#toSlider");
  if (Number(currentTarget.value) <= 0) {
    toSlider.style.zIndex = 2;
  } else {
    toSlider.style.zIndex = 0;
  }
}

fillSlider(fromSlider, toSlider, "#C6C6C6", "#0d6efd", toSlider);
setToggleAccessible(toSlider);

fromSlider.oninput = () => controlFromSlider(fromSlider, toSlider, fromInput);
toSlider.oninput = () => controlToSlider(fromSlider, toSlider, toInput);
fromInput.oninput = () =>
  controlFromInput(fromSlider, fromInput, toInput, toSlider);

toInput.addEventListener("change", () =>
  controlToInput(toSlider, fromInput, toInput, toSlider)
);
