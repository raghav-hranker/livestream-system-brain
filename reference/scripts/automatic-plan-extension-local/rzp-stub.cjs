// Local test preload: replaces the `razorpay` SDK so no request ever leaves this machine.
// orders.create / paymentLink.create return stub ids like the integration test's stub.
const Module = require('module');
let seq = 0;
class FakeRazorpay {
  constructor() {
    const stamp = () => `${Date.now().toString(36)}${++seq}`;
    this.orders = { create: async (p) => ({ id: `order_stub_${stamp()}`, amount: p.amount, currency: 'INR', receipt: p.receipt, status: 'created' }) };
    this.paymentLink = { create: async (p) => ({ id: `plink_stub_${stamp()}`, short_url: 'https://rzp.io/stub', amount: p.amount, currency: 'INR', status: 'created' }) };
    const refuse = new Proxy({}, { get: () => async () => { throw new Error('razorpay stub: not available locally'); } });
    this.payments = refuse; this.refunds = refuse; this.customers = refuse;
  }
}
FakeRazorpay.validateWebhookSignature = () => false;
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'razorpay') return FakeRazorpay;
  return origLoad.call(this, request, ...rest);
};
console.log('[rzp-stub] razorpay SDK replaced with local stub');
