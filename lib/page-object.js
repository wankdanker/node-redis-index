module.exports = PageObject;

function PageObject(page, size, total) {
  this.page = page || 1;
  this.size = size || 10;
  this.total = total;

  this.count = Math.ceil(this.total / this.size);
  this.start = (this.page - 1) * this.size;
  this.stop = (this.start + this.size - 1 > this.total) ? this.total -1 : this.start + this.size - 1;
  this.first = 1;
  this.last = this.count;
  this.next = (this.page + 1 > this.count) ? null : this.page + 1;
  this.previous = (this.page - 1 < 1) ? null : page - 1;
}
