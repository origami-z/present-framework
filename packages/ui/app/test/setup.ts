import "@testing-library/jest-dom";

// jsdom does not implement URL.createObjectURL / revokeObjectURL
URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();
