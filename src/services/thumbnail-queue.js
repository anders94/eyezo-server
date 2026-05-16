// Thumbnail generation queue with concurrency control
// Ensures only a limited number of thumbnails are generated at once

class ThumbnailQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.inProgress = new Map(); // Track in-progress generations by relativePath
  }

  // Add a thumbnail generation task to the queue
  async enqueue(relativePath, generator) {
    // Check if this thumbnail is already being generated
    if (this.inProgress.has(relativePath)) {
      // Wait for the existing generation to complete
      return this.inProgress.get(relativePath);
    }

    // Create a promise for this generation
    const promise = new Promise((resolve, reject) => {
      this.queue.push({
        relativePath,
        generator,
        resolve,
        reject
      });
    });

    // Store the promise so other requests can wait for it
    this.inProgress.set(relativePath, promise);

    // Try to process the queue
    this.processQueue();

    return promise;
  }

  // Process queued tasks
  async processQueue() {
    // Don't start new tasks if we're at capacity
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // Get the next task
    const task = this.queue.shift();
    if (!task) return;

    this.running++;

    try {
      // Run the generator function
      const result = await task.generator();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      // Clean up
      this.running--;
      this.inProgress.delete(task.relativePath);

      // Process next task in queue
      this.processQueue();
    }
  }

  // Get queue status
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      inProgress: this.inProgress.size
    };
  }
}

// Global thumbnail queue instance
const thumbnailQueue = new ThumbnailQueue(2); // Max 2 concurrent thumbnail generations

module.exports = {
  thumbnailQueue,
  ThumbnailQueue
};
