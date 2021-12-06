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
function renderDemo2 (container) {
  class Title extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        number: 1
      }
    }

    handleClick = () => {
      // console.log('handleClick');
      this.setState({number: this.state.number + 1})
    }
    // mount阶段生命周期
    componentWillMount() {
      // console.log('componentWillMount');
    }

    componentDidMount() {
      // console.log('componentDidMount')
    }

    // update阶段
    componentWillReceiveProps(nextProps) {
      // console.log('componentWillReceiveProps', nextProps);
    }

    shouldComponentUpdate(nextProps, nextState) {
      // console.log('shouldComponentUpdate', nextProps, nextState);
      return true;
    }

    componentDidUpdate(prevProps, prevState) {
      // console.log('componentDidUpdate', prevProps, prevState)
    }

    // 卸载阶段
    componentDidUnMount() {
      // console.log('componentDidUnMount')
    }

    render() {
      const element = React.createElement(
        'h1', 
        {
          style: { 
            color: "red", 
            backgroundColor: "green",
            textAlign: 'center',
            userSelect: "none" 
          },
          className: "h",
          onClick: this.handleClick
        }, 
        this.props.name, 
        this.state.number
      );
      return (element)
    }
  }
  const titleElement = React.createElement(Title, {name: "Hello Word!"}) 
  React.render(titleElement, container)
}

 export default renderDemo2