import $ from "jquery";
import { Element } from "./element";
import types from "./types";

let diffQueue = [];     //diff处理之后将需要处理的队列
let updateDepth = 0;    //diff算法是否执行完毕的标志
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
  update(nextElement) {
    if(this._currentElement !== nextElement) {
      this._currentElement = nextElement;
      $(`[data-reactid="${this._reactId}"]`).html(nextElement);
    }
  }
}

// 处理原生组件
class NativeUnit extends Unit {
  getMarkUp(reactId) {
    this._reactId = reactId;
    const { type, props } = this._currentElement;
    let tagStart = `<${type} data-reactid="${reactId}" `;
    let tagEnd = `</${type}>`;
    let childrenString = '';
    this._renderedChildrenUnits = []
    for (let propName in props) {
      if(propName === 'className') { // 处理类名
        tagStart += `class="${props[propName]}" `
      } else if(propName === 'style') { // 处理样式
        tagStart += `style="${
          Object
            .entries(props[propName])
            .map(([key, value])=> {
              return `${key.replace(/[A-Z]/, m=> `-${m.toLowerCase()}`)}: ${value}`
            })
            .join(";")
        }" `
      } else if(/^on[A-Z]/.test(propName)) { // 绑定事件
        const eventName = propName.slice(2).toLowerCase()
        $(document).delegate(`[data-reactid="${this._reactId}"]`, `${eventName}.${this._reactId}`, props[propName]);
      } else if(propName === 'children') {
        (props[propName]).forEach((child, index) => {
          const childUnit = createUnit(child); 
          childUnit._mountIndex = index; // 记录当前子节点在所有子节点中的位置
          this._renderedChildrenUnits.push(childUnit);
          const childMarkup = childUnit.getMarkUp(`${this._reactId}.${index}`);
          childrenString += childMarkup;
        });
      } else {
        tagStart += `${propName}=${props[propName]} `;
      }
    }
    return `${tagStart}>${childrenString}${tagEnd}`;
  }

  update(nextElement) {
    const oldProps = this._currentElement.props;
    const newProps = nextElement.props;
    this.updateDOMProperties(oldProps, newProps);
    this.updateDomChildren(nextElement.props.children);
  }

  updateDOMProperties(oldProps, newProps) {
    let propName;
    for(propName in oldProps) {
      if(!newProps.hasOwnProperty(propName)) {
        $(`[data-reactid="${this._reactId}"]`).removeAttr(propName);
      }
      if(/^on[A-Z]/.test(propName)) {
        $(document).undelegate(`.${this._reactId}`);
      }
    }
    for(propName in newProps) {
      if(propName === "children") { //如果是children属性，就跳过，暂不处理
        continue;
      } else if(/^on[A-Z]/.test(propName)) {
        const eventName = propName.slice(2).toLowerCase(); //获取事件名称
        $(document).delegate(`[data-reactid="${this._reactId}"]`, `${eventName}.${this._reactId}`, newProps[propName]);
      } else if(propName === 'className') {//将新的类名赋值给当前的元素
        $(`[data-reactid="${this._reactId}"]`).attr('class', newProps[propName]);
      } else if(propName === 'style') {
        const styleObj = newProps[propName];
        Object.entries(styleObj).map(([attr, value]) => {
          $(`[data-reactid="${this._reactId}"]`).css(attr, value);
        })
      } else {
        $(`[data-reactid="${this._reactId}"]`).props(propName, newProps[propName]);
      }
    }
  }

  // 此处要把新的儿子们传过来，然后与老的儿子们进行对比，然后找出差异，进行修改dom
  updateDomChildren(newChildrenElements) {
    updateDepth++;
    this.diff(diffQueue, newChildrenElements);
    updateDepth--;
    if(updateDepth === 0) {
      this.patch(diffQueue);
      diffQueue = [];
    }
  }

  diff(diffQueue, newChildrenElements) {
    let oldChildrenUnitMap = this.getOldChildrenMap(this._renderedChildrenUnits);
    let { newChildrenUnitMap, newChildrenUnits } = this.getNewChildren(oldChildrenUnitMap, newChildrenElements);
    let lastIndex = 0; 
    for (let i = 0; i < newChildrenUnits.length; i++) {
      const newUnit = newChildrenUnits[i];
      const newKey = newUnit._currentElement.props && newUnit._currentElement.props.key || i.toString();
      const oldChildUnit = oldChildrenUnitMap[newKey];
      if(oldChildUnit === newUnit) {
        if(oldChildUnit._mountIndex < lastIndex) {
          diffQueue.push({
            parentId: this._reactId,
            parentNode: $(`[data-reactid="${this._reactId}"]`),
            type: types.MOVE,
            fromIndex: oldChildUnit._mountIndex,
            toIndex: i,
          })
        }
        lastIndex = Math.max(lastIndex, oldChildUnit._mountIndex);
      } else {
        if(oldChildUnit) {
          diffQueue.push({
            parentId: this._reactId,
            parentNode: $(`[data-reactid="${this.reactId}"]`),
            type: types.REMOVE,
            fromIndex: oldChildUnit._mountIndex
          });
          this._renderedChildrenUnits = this._renderedChildrenUnits.filter(item => item != oldChildUnit);
          $(document).undelegate(`.${oldChildUnit._reactId}`)
        }
        diffQueue.push({
          parentId: this._reactId,
          parentNode: $(`[data-reactid="${this._reactId}"]`),
          type: types.INSERT,
          toIndex: i,
          markUp: newUnit.getMarkUp(`${this._reactId}.${i}`)
        })
      }
      newUnit._mountIndex = i;
    }
    for(let oldKey in oldChildrenUnitMap) {
      let oldChild = oldChildrenUnitMap[oldKey];
      if(!newChildrenUnitMap.hasOwnProperty(oldKey)) {
        diffQueue.push({
          parentId: this._reactId,
          parentNode: $(`[data-reactid="${this._reactId}"]`),
          type: types.REMOVE,
          fromIndex: oldChild._mountIndex
        })
        this._renderedChildrenUnits = this._renderedChildrenUnits.filter(item => item != oldChild);
        $(document).undelegate(`.${oldChild._reactId}`);
      }
    }
  }

  getOldChildrenMap(childrenUnits=[]) {
    let map = {};
    for (let i = 0; i < childrenUnits.length; i++) {
      const unit = childrenUnits[i];
      const key = unit._currentElement.props && unit._currentElement.props.key || i.toString();
      map[key] = unit;
    }
    return map;
  }

  getNewChildren(oldChildrenUnitMap, newChildrenElements) {
    let newChildrenUnits = [];
    let newChildrenUnitMap = {};
    newChildrenElements.forEach((newElement, index) => {
      const newKey = (newElement.props && newElement.props.key) || index.toString();
      const oldUnit = oldChildrenUnitMap[newKey];
      const oldElement = oldUnit && oldUnit._currentElement;
      if(shouldDeepCompare(oldElement, newElement)) {
        oldUnit.update(newElement);
        newChildrenUnits.push(oldUnit);
        newChildrenUnitMap[newKey] = oldUnit;
      } else {
        const nextUnit = createUnit(newElement);
        newChildrenUnits.push(nextUnit);
        newChildrenUnitMap[newKey] = nextUnit;
        this._renderedChildrenUnits[index] = nextUnit;
      }
    })
    return { newChildrenUnitMap, newChildrenUnits };
  }

  patch(diffQueue) {
    let deleteChildren = [];
    let deleteMap = {};//这里暂存能复用的节点
    for(let i = 0; i < diffQueue.length; i++) {
      let difference = diffQueue[i];
      if(difference.type === types.MOVE || difference.type === types.REMOVE) {
        let fromIndex = difference.fromIndex;
        let oldChild = $(difference.parentNode.children().get(fromIndex));
        if(!deleteMap[difference.parentId]) {
          deleteMap[difference.parentId] = {}
        }
        deleteMap[difference.parentId][fromIndex] = oldChild;
        deleteChildren.push(oldChild)
      }
    }
    $.each(deleteChildren, (i, item) => $(item).remove());

    for (let i= 0; i < diffQueue.length; i++) {
      const difference = diffQueue[i];
      switch(difference.type) {
        case types.INSERT: 
          this.insertChildAt(difference.parentNode, difference.toIndex, $(difference.markUp));
          break;
        case types.MOVE: 
          this.insertChildAt(difference.parentNode, difference.toIndex, deleteMap[difference.parentId][difference.fromIndex]);
      }
    }
  }
  
  insertChildAt(parentNode, index, newNode) {
    const oldChild = parentNode.children().get(index);
    oldChild ? newNode.insertBefore(oldChild) : newNode.appendTo(parentNode);
  }

}

class CompositeUnit extends Unit {
  // 组件更新操作
  update(nextElement, partialState) {
    // 获取到新的元素
    this._currentElement = nextElement || this._currentElement
    // 获取新的状态，不管要不要更新组件，组件的状态一定要修改
    const nextState = Object.assign(this._componentInstance.state, partialState);
    // 获取新的属性对象
    const nextProps = this._currentElement.props;
    if(this._componentInstance.shouldComponentUpdate && !this._componentInstance.shouldComponentUpdate(nextProps, nextState)) {
      return ;
    }
    // 获取上次渲染的单元
    const preRenderedUnitInstance = this._renderedUnitInstance;
    // 得到上次渲染的元素
    const preRenderedElement = preRenderedUnitInstance._currentElement;
    const nextRenderedElement = this._componentInstance.render();
    // 如果新旧两个元素类型一样,则可以进行深度的比较,如果不一样,就直接干掉老的元素,重新创建
    if(shouldDeepCompare(preRenderedElement, nextRenderedElement)) {
      // 如果可以进行审比较,则把更新的工作教给上次渲染出来的那个element元素对应的unit进行处理
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
    if(oldElement instanceof Element && newElement instanceof Element) {
      return oldElement.type == newElement.type;
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