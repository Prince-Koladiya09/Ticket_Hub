/** Shared Mongoose options: timestamps, and JSON output with `id` instead of `_id`/`__v`. */
export const baseOptions = {
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (doc, ret) => {
      if (ret._id) {
        ret.id = ret._id.toString();
        delete ret._id;
      }
      return ret;
    },
  },
};
