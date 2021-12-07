import $ from 'jquery';
import createUnit from "./unit";
import { createElement } from "./element";
import { Component } from "./component";
let React = {
  render,
  createElement,
  Component
}

function render(element, container) {
  const unit = createUnit(element);
  const markUp = unit.getMarkUp(0);
  $(container).html(markUp);
  $(document).trigger("mounted")
}

export default React;