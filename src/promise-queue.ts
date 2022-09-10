class PromiseQueue {
    private handlers: (() => Promise<void>)[] =  [];

    async handleAll() {
        for (let i = 0; i < this.handlers.length; i++) await this.handlers[i]()
        this.handlers = [];
    }

    enqueue<T>(handler: () => T) {
        return new Promise<T>((resolve, reject) => {
            this.handlers.push(async () => {
                try { resolve(await handler()); }
                catch (error) { reject(error); }
            });
            if (this.handlers.length === 1) this.handleAll().catch(console.error);
        });
    }
}
