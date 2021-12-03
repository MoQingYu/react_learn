import $ from "jquery";
import { Element } from "./element";
class Unit {
  constructor(element) {
    // 凡是挂载到私有属性上的都是_下划线开头
    this._currentElement = element;
  }
  getMarkUp() {
    throw Error('此方法不能被调用');
  }
}

// 处理文本组件
class TextUnit extends Unit {
  getMarkUp(reactId) {
    this._reactId = reactId;
    return `<span data-reactid="${reactId}">${this._currentElement}</span>`
  }
}

// 处理原生组件
class NativeUnit extends Unit {
  getMarkUp(reactId) {
    this._reactId = reactId;
    const { type, props } = this._currentElement;
    let tagStart = `<${type} data-reactid=${reactId} `;
    let tagEnd = `</${type}>`;
    let childrenString = '';
    this._renderedChildrenUnit = []
    for (let propsName in props) {
      if(propsName === 'className') { // 处理类名
        tagStart += `class="${props[propsName]}" `
      } else if(propsName === 'style') { // 处理样式
        tagStart += `style="${
          Object
            .entries(props[propsName])
            .map(([key, value])=> {
              return `${key.replace(/[A-Z]/, m=> `-${m.toLowerCase()}`)}: ${value}`
            })
            .join(";")
        }" `
      } else if(/^on[A-Z]/.test(propsName)) { // 绑定事件
        const eventName = propsName.slice(2).toLowerCase()
        $(document).delegate([`data-reactid=${reactId}`], `${eventName}.${this._reactId}`, props[propsName]);
      } else if(propsName === 'children') {
        (props[propsName]).forEach((child, index) => {
          const childUnit = createUnit(child); 
          childUnit._mountIndex = index; // 记录当前子节点在所有子节点中的位置
          this._renderedChildrenUnit.push(childUnit);
          const childMarkup = childUnit.getMarkUp(`${reactId}.${index}`);
          childrenString += childMarkup;
        });
      } else {
        tagStart += `${propsName}=${props[propsName]} `;
      }
    }
    return `${tagStart}>${childrenString}${tagEnd}`;
  }

}

class CompositeUnit extends Unit {

  update(nextElement, partialState) {
    this._currentElement = nextElement || this._currentElement;
    const nextState = Object.assign(this._componentInstance.state, partialState);
    const nextProps = this._currentElement.props;
    if(this.componentInstance.shouldComponentUpdate && !this.componentInstance.shouldComponentUpdate(nextProps, nextState)) {
      return ;
    }
    const preRenderedUnitInstance = this._renderedUnitInstance;
    const preRenderedElement = preRenderedUnitInstance.renderedElement;
    const nextRenderedElement = this._componentInstance.render();
    if(shouldDeepCompare(preRenderedElement, nextRenderedElement)) {
      preRenderedUnitInstance.update(nextRenderedElement);
      this._componentInstance.componentDidUpdate && this._componentInstance.componentDidUpdate()
    } else {
      this._renderedUnitInstance = createUnit(nextRenderedElement);
      const nextMarkUp = this._renderedUnitInstance.getMarkUp();
      $(`[data-reactid="${this._reactId}"]`).replaceWith(nextMarkUp);
    }
  }

  getMarkUp(reactId) {
    this._reactId = reactId;
    const { type: Component, props } = this._currentElement;
    const componentInstance = this._componentInstance = new Component(props);
    // 让组件实例的currentUnit属性等于当前unit
    componentInstance._currentUnit = this;
    // 如果组件有componentWillMount钩子函数的话就执行
    componentInstance.componentWillMount&&componentInstance.componentWillMount();
    // 调用组件的render方法，得到要渲染的元素
    const renderedElement = componentInstance.render();
    // 获取这个元素的unit
    const renderedUnitInstance = this._renderedUnitInstance = createUnit(renderedElement);
    // 通过unit可以获取对应的html，标记MarkUp
    const renderedMarkUp = renderedUnitInstance.getMarkUp(reactId);
    // 绑定自定义事件mounted，真实dom生成之后触发该事件
    $(document).on("mounted", () => {
      // 执行mounted钩子函数
      componentInstance.componentDidMount&&componentInstance.componentDidMount();
    })
    return renderedMarkUp;
  }

}

function shouldDeepCompare(oldElement, newElement) {
  if(oldElement !== null && newElement !== null) {
    const oldType = typeof(oldElement);
    const newType = typeof(newElement);
    if((oldType === "number" || oldType === "string") && (newType === "number" || newType === "string")) {
      return true;
    }
    if(oldType instanceof Element && newElement instanceof Element) {
      return oldElement.type === newElement.type;
    }
  }
  return false;
}

function createUnit(element) {
  if(typeof(element) === "number" || typeof(element) === "string") {
    return new TextUnit(element);
  }
  if(element instanceof Element && typeof(element.type) === "string") {
    return new NativeUnit(element);
  }
  if(element instanceof Element && typeof(element.type) === "function") {
    return new CompositeUnit(element);
  }
}


export default createUnit