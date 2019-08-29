function _defineProperty(obj, key, value) {if (key in obj) {Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });} else {obj[key] = value;}return obj;}const products = [
{ name: 'General cleaning', price: 55, add: true },
{ name: 'Laundry package (for 2 pers.)', price: 13, add: false, dayPrice: false },
{ name: 'Highchair (per day)', price: 3, add: false, dayPrice: true },
{ name: 'Cot (per day)', price: 3, add: false, dayPrice: true },
{ name: 'Deposit', price: 100, add: false, dayPrice: false },
{ name: 'Laundry package (for 3rd and 4th pers.)', price: 19, add: false, dayPrice: false },
{ name: 'Booking', price: 15, add: false, dayPrice: false }];


const Input = ({
  value,
  onChange,
  onSubmit }) =>
{
  return (
    React.createElement("form", { onSubmit: onSubmit },
    React.createElement("input", {
      className: "input",
      type: "number",
      min: "1",
      max: "90",
      value: value,
      onChange: onChange })));



};

class Price extends React.Component {constructor(...args) {super(...args);_defineProperty(this, "state",
    {
      products,
      sum: 55,
      stayDays: 7 });_defineProperty(this, "onInputChange",


    e => {
      let stayDays = e.target.value;
      this.setState({ stayDays });
      this.updateSum(stayDays);
    });_defineProperty(this, "onInputSubmit",

    e => {
      e.preventDefault();
    });_defineProperty(this, "changeAdd",

    index => {
      const { products } = this.state;
      products[index].add = !products[index].add;
      this.setState({
        products });

    });_defineProperty(this, "updateSum",

    stayDays => {
      const { products } = this.state;
      let allItemsSum = 0;
      let addPrice;

      {
        products.map(product => {
          addPrice = product.price * (product.dayPrice ? stayDays : 1);
          product.add ? allItemsSum += addPrice : 0;
        });
      }

      this.setState({
        sum: allItemsSum });

    });_defineProperty(this, "handleClick",

    e => {
      const { index } = e.currentTarget.dataset;
      const { stayDays } = this.state;

      this.changeAdd(index);
      this.updateSum(stayDays);
    });}

  render() {
    const { products, sum } = this.state;
    return (
      React.createElement("div", { className: "card" },
      React.createElement("h2", null, "Additional services"),
      React.createElement("div", { className: "wrap" },
      React.createElement("div", { className: "left" },
      React.createElement("img", { src: "https://github.com/OlgaKoplik/CodePen/blob/master/bg1.png?raw=true" }),
      React.createElement("form", null,
      React.createElement("label", { className: "prev__input form-label", htmlFor: "days" }, "Stay time:"),
      React.createElement(Input, {
        value: this.state.stayDays,
        onChange: this.onInputChange,
        onSubmit: this.onInputSubmit,
        id: "days" }),

      React.createElement("label", { className: "after__input form-label", htmlFor: "days" }, "Days"))),


      React.createElement("div", { className: "right" },
      React.createElement("ul", null,
      products.map((product, index) =>
      React.createElement("li", {
        "data-index": index,
        onClick: this.handleClick,
        className: "product price__add" },

      product.add ?
      React.createElement("i", { className: "fas fa-check-circle icon icon-delete delete" }) :

      React.createElement("i", { className: "fas fa-plus-circle icon icon-add add" }),

      React.createElement("div", { className: "price__descr" },
      React.createElement("div", { className: "price__item" }, product.name)),

      product.dayPrice ?
      React.createElement("div", { className: "price day-price" }, "\u20AC ", product.price, ".", React.createElement("sup", null, "00")) :

      React.createElement("div", { className: "price" }, "\u20AC ", product.price, ".", React.createElement("sup", null, "00"))))),




      React.createElement("div", { className: "price__summe" },
      React.createElement("h3", null, "total:"), React.createElement("span", { className: "summe-span" }, "\u20AC ",
      sum, ".", React.createElement("sup", null, "00")))))));






  }}



ReactDOM.render(
React.createElement(Price, null),
document.getElementById('root'));