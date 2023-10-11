import { useDebugValue, useEffect, useState } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

type StateListener<T> = (state: T, previousState: T) => void;

function store<T>(createStore: () => T | T) {
  let state = typeof createStore === 'function' ? createStore() : createStore;

  const listeners: Set<StateListener<T>> = new Set();

  const setState = (newState: (pre: T) => T | T) => {
    const nextState =
      typeof newState === 'function' ? newState(state) : newState;

    if (nextState !== state) {
      const previousState = state;
      state = nextState;
      listeners.forEach(listener => listener(state, previousState));
    }
  };

  const getState = () => state;

  const subscribe = (listener: StateListener<T>) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => listeners.clear();

  return {
    setState,
    getState,
    subscribe,
    destroy
  };
}
export default store;

interface StoreState<T> {
  setState: (newState: (pre: T) => T | T) => void;
  getState: () => T;
  subscribe: (listener: StateListener<T>) => () => void;
  destroy: () => void;
}

// store的简易实现 -- useSyncExternalStore
export const useStore = <T>(stores: StoreState<T>) => {
  const slice: T = useSyncExternalStore<T>(
    stores.subscribe,
    stores.getState,
    stores.getState // ssr才会用得到
  );
  useDebugValue(slice);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {slice, setSlice: stores.setState};
};


// ? zustand  react-redux  xstate  recoil 等都已经引入了这个新的api。
// 也可以使用new Proxy()来劫持store，通过getter setter来订阅和更新
// useStore使用的是暴露hook，通过hook执行 来订阅和更新

// 最开始，写过一个store，是所有class组件都extends我写的一个Component，这个Component挂载一个forceUpdate函数
// 然后也通过new Proxy()来劫持store，通过getter收集使用store的组件，通过setter，强制执行forceUpdate函数

// 测试使用useState实现useSyncExternalStore的效果
// 利用 useState的强制更新 实现更简易的 store
export const useCustomStore = <T>(stores: StoreState<T>) => {
  const [slice, setData] = useState(stores.getState());

  // 这个是最重要的，每一个用这个store管理的组件，他们里面的setData（forceUpdate）都被订阅了
  // 如果有10个组件用了这个store管理，那么stores里面的subscribe就放了10个forceUpdate的callback
  // 如果没有这个东西，那么每个组件改变状态，仅仅会改变自己组件的forceUpdate，通知不到其他组件
  stores.subscribe(setData);

  useEffect(() => {
    // 这里可以做一些钩子或者状态检测。。。
  }, []);

  const setSlice = (newState: (pre: T) => T | T) => {
    // 一个组件通过这个改变store，这个stores.setState里面有执行所有subscribe的逻辑
    // 所以如果没有stores.subscribe(setData);仅仅在这做自己的setData()；那么就只有自己组件更新
    stores.setState(newState);
  };

  return {slice, setSlice};
};