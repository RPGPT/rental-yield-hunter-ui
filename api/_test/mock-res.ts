export class MockRes {
  _status = 200;
  _body: unknown = null;
  status(code: number): this {
    this._status = code;
    return this;
  }
  json(body: unknown): this {
    this._body = body;
    return this;
  }
  send(body: unknown): this {
    this._body = body;
    return this;
  }
  setHeader(): this {
    return this;
  }
}
