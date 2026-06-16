import { renderHook, act } from "@testing-library/react-native";
import { useSSEStream } from "../useSSEStream";

jest.mock("../../api/client", () => ({
  getApiBaseUrl: jest.fn(() => "http://localhost:8000"),
}));

jest.mock("../../components/Toast", () => ({
  showToast: jest.fn(),
}));

function mockFetchStream(chunks: string[], ok = true, status = 200): jest.Mock {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return jest.fn().mockResolvedValue({
    ok,
    status,
    body: { getReader: () => stream.getReader() },
  }) as unknown as jest.Mock;
}

describe("useSSEStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  it("returns initial state", () => {
    const { result } = renderHook(() => useSSEStream());
    expect(result.current.streaming).toBe(false);
    expect(typeof result.current.startStream).toBe("function");
    expect(typeof result.current.cancelStream).toBe("function");
  });

  it("calls onContent with accumulated text as chunks arrive", async () => {
    const chunks = [
      'data: {"type":"generating","content":"Hello"}\n',
      'data: {"type":"generating","content":" World"}\n',
      'data: {"type":"done","success":true}\n',
    ];
    (global.fetch as jest.Mock) = mockFetchStream(chunks);

    const { result } = renderHook(() => useSSEStream());
    const onContent = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await act(async () => {
      await result.current.startStream({
        question: "test",
        onContent,
        onDone,
        onError,
      });
    });

    expect(onContent).toHaveBeenCalledTimes(2);
    expect(onContent).toHaveBeenLastCalledWith("Hello World");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.streaming).toBe(false);
  });

  it("handles HTTP error by throwing", async () => {
    (global.fetch as jest.Mock) = mockFetchStream([], false, 500);

    const { result } = renderHook(() => useSSEStream());
    const onContent = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await expect(
      act(async () => {
        await result.current.startStream({
          question: "test",
          onContent,
          onDone,
          onError,
        });
      }),
    ).rejects.toThrow();

    expect(onDone).not.toHaveBeenCalled();
  });

  it("cancelStream aborts in-flight request", async () => {
    const stream = new ReadableStream({
      start() {
        // never ends
      },
    });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => stream.getReader() },
    });

    const { result } = renderHook(() => useSSEStream());
    const onContent = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    act(() => {
      result.current.startStream({
        question: "test",
        onContent,
        onDone,
        onError,
      });
    });

    act(() => {
      result.current.cancelStream();
    });

    expect(result.current.streaming).toBe(false);
  });

  it("sets streaming to true during request", async () => {
    const chunks = ['data: {"type":"done","success":true}\n'];
    (global.fetch as jest.Mock) = mockFetchStream(chunks);

    const { result } = renderHook(() => useSSEStream());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.startStream({
        question: "test",
        onContent: jest.fn(),
        onDone: jest.fn(),
        onError: jest.fn(),
      });
    });

    expect(result.current.streaming).toBe(true);

    await act(async () => {
      await promise!;
    });

    expect(result.current.streaming).toBe(false);
  });
});
