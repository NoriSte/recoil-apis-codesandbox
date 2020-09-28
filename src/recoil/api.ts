import {
  AtomOptions,
  SelectorOptions,
  RecoilValueOptions,
  isAtomOptions,
  PreflightGetRecoilValue
} from "./typings";
import { useReducer, useEffect, useCallback, useContext } from "react";
import { RecoilContext } from "./RecoilRoot";
import {
  setAtomValue,
  getRecoilValue,
  getPreflightGetRecoilValue,
  getPreflightSetRecoilValue,
  subscribeToRecoilValue,
  registerRecoilValue
} from "./core";

/**
 * Register a new atom.
 * Please note: it does nothing for the sake of this exercise
 */
export const atom = <T extends any = any>(atomOptions: AtomOptions<T>) => {
  return atomOptions;
};

/**
 * Register a new selector.
 * Please note: it does nothing for the sake of this exercise
 */
export const selector = <T extends any = any>(
  selectorOptions: SelectorOptions<T>
) => {
  return selectorOptions;
};

/**
 * Subscribe to all the Recoil Values updaters and Returns the current value.
 */
export const useRecoilValue = <T>(options: RecoilValueOptions<T>) => {
  const recoilId = useRecoilId();
  const [, forceRender] = useReducer((s) => s + 1, 0);
  const subscriptionCallback = useCallback(() => {
    forceRender();
  }, [forceRender]);

  registerRecoilValue(recoilId, options);
  useSubscribeToRecoilValues(options, subscriptionCallback);
  return getRecoilValue(recoilId, options);
};

/**
 * Subscribe to all the Recoil Values updaters and returns both the current value and a setter.
 */
export const useRecoilState = <T>(options: RecoilValueOptions<T>) => {
  const recoilId = useRecoilId();
  const useRecoilValueResult = useRecoilValue(options);

  registerRecoilValue(recoilId, options);

  if (isAtomOptions(options)) {
    const setter = setAtomValue(recoilId, options);
    return [useRecoilValueResult, setter] as const;
  } else {
    const setter = (newValue: T) => {
      options.set?.(
        {
          get: getPreflightGetRecoilValue(recoilId),
          set: getPreflightSetRecoilValue(recoilId)
        },
        newValue
      );
    };
    return [useRecoilValueResult, setter] as const;
  }
};

type Callback = () => void;
/**
 * Subscribe to all the uopdates from the involved Recoil Values
 */
const useSubscribeToRecoilValues = <T>(
  options: RecoilValueOptions<T>,
  callback: Callback
) => {
  const recoilId = useRecoilId();
  useEffect(() => {
    if (isAtomOptions(options)) {
      return subscribeToRecoilValue(recoilId, options.key, callback);
    } else {
      const dependencies: string[] = [];

      options.get({ get: createDependenciesSpy(recoilId, dependencies) });
      const unsubscribes: Callback[] = [];
      dependencies.forEach((key) => {
        const unsubscribe = subscribeToRecoilValue(recoilId, key, callback);
        if (unsubscribe) unsubscribes.push(unsubscribe);
      });

      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }
  }, [recoilId, options, callback]);
};

/**
 * Figure out the dependencies tree of each selector
 */
const createDependenciesSpy = (recoilId: string, dependencies: string[]) => {
  const dependenciesSpy: PreflightGetRecoilValue = (...params) => {
    const recoilValueOptions = params[0];
    dependencies.push(recoilValueOptions.key);

    if (isAtomOptions(recoilValueOptions)) {
      return getRecoilValue(recoilId, ...params);
    } else {
      return recoilValueOptions.get({ get: dependenciesSpy });
    }
  };

  return dependenciesSpy;
};

const useRecoilId = () => {
  const recoilId = useContext(RecoilContext);
  if (!recoilId) {
    throw new Error("Wrap your app with <RecoilRoot>");
  }

  return recoilId;
};
