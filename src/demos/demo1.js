import React from "../React";

/**
 * virtual dom
 * {
 *    type: 'h1',
 *    props: {
 *      style: {
 *        color: 'red',
 *        textAlign: 'center' 
 *      }
 *    }
 *    children: ['hello word！']
 * }
 * */ 
function renderDemo1 (container) {
  function onClick() {
    console.log("hello word");
  }
  const demo1 = React.createElement(
    'h1', 
    {
      style: { 
        color: "red", 
        backgroundColor: "green",
        textAlign: 'center',
        userSelect: "none" 
      },
      className: "h",
      onClick
    }, 'hello word!');
  React.render(demo1, container)
}

 export default renderDemo1