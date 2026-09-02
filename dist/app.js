document.documentElement.classList.add('motion-ready');

const copyStatus = document.querySelector('.copy-status');
const navigationToggle = document.querySelector('.nav-toggle');
const primaryNavigation = document.querySelector('#primary-navigation');
const operationSearch = document.querySelector('#operation-search');
const operationCategory = document.querySelector('#operation-category');
const operationResults = document.querySelector('#operation-results');
const operationResultCount = document.querySelector('#operation-result-count');
const operationLoadMore = document.querySelector('#operation-load-more');
const contractVersion = document.querySelector('#contract-version');
const operationIndex = window.MOODLIA_OPERATION_INDEX ?? {
  contractVersion: 'unavailable',
  operationCount: 0,
  operations: [],
};

const resultPageSize = 18;
let visibleOperationCount = resultPageSize;
let filteredOperations = [];
let statusTimeout;
let searchAnnouncementTimeout;

function showStatus(message) {
  if (!copyStatus) {
    return;
  }

  copyStatus.textContent = message;
  copyStatus.classList.add('visible');
  window.clearTimeout(statusTimeout);
  statusTimeout = window.setTimeout(() => {
    copyStatus.classList.remove('visible');
  }, 2200);
}

async function copyText(text, successMessage = 'Copied to clipboard.') {
  try {
    await navigator.clipboard.writeText(text);
    showStatus(successMessage);
    return;
  } catch {
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = text;
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.className = 'sr-only';
    document.body.append(temporaryInput);
    temporaryInput.select();

    try {
      const copied = document.execCommand('copy');
      showStatus(copied ? successMessage : 'Clipboard access is not available.');
    } catch {
      showStatus('Clipboard access is not available.');
    } finally {
      temporaryInput.remove();
    }
  }
}

function installCodeCopyControls() {
  for (const [index, codeBlock] of document.querySelectorAll('pre[data-copy]').entries()) {
    if (!codeBlock.id) {
      codeBlock.id = `code-example-${index + 1}`;
    }

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'copy-control';
    copyButton.textContent = 'Copy';
    copyButton.setAttribute('aria-label', `Copy code example ${index + 1}`);
    copyButton.addEventListener('click', () => {
      const sourceCode = codeBlock.querySelector('code')?.textContent ?? codeBlock.textContent;
      copyText(sourceCode.trim(), 'Code copied.');
    });
    codeBlock.append(copyButton);
  }
}

function activateTab(selectedTab, moveFocus = false) {
  const tabList = selectedTab.closest('[role="tablist"]');
  if (!tabList) {
    return;
  }

  for (const tab of tabList.querySelectorAll('[role="tab"]')) {
    const isSelected = tab === selectedTab;
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    if (panel) {
      panel.hidden = !isSelected;
    }
  }

  if (moveFocus) {
    selectedTab.focus();
  }
}

function installTabs() {
  for (const tabList of document.querySelectorAll('[role="tablist"]')) {
    const tabs = [...tabList.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', (event) => {
        let targetIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          targetIndex = (index + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          targetIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          targetIndex = 0;
        } else if (event.key === 'End') {
          targetIndex = tabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateTab(tabs[targetIndex], true);
      });
    });
  }
}

function setNavigationOpen(isOpen) {
  if (!navigationToggle || !primaryNavigation) {
    return;
  }

  navigationToggle.setAttribute('aria-expanded', String(isOpen));
  navigationToggle.querySelector('.sr-only').textContent = isOpen ? 'Close navigation' : 'Open navigation';
  primaryNavigation.classList.toggle('open', isOpen);
}

function installNavigation() {
  navigationToggle?.addEventListener('click', () => {
    setNavigationOpen(navigationToggle.getAttribute('aria-expanded') !== 'true');
  });

  primaryNavigation?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setNavigationOpen(false);
    }
  });
}

function installRevealAnimations() {
  const revealElements = document.querySelectorAll('.reveal');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  revealElements.forEach((element) => observer.observe(element));
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

function buildOperationCard(operation) {
  const card = createElement('article', 'operation-card');
  const header = createElement('div', 'operation-card-header');
  const badge = createElement('span', `operation-badge ${operation.type}`, operation.type);
  const copyButton = createElement('button', 'operation-copy', '⧉');
  copyButton.type = 'button';
  copyButton.setAttribute('aria-label', `Copy CLI help command for ${operation.name}`);
  copyButton.addEventListener('click', () => {
    copyText(`moodlia ${operation.command} --help`, `Command for ${operation.name} copied.`);
  });
  header.append(badge, copyButton);

  const heading = createElement('h3', '', operation.name);
  const summary = createElement('p', '', operation.summary);
  const metadata = createElement('div', 'operation-meta');
  metadata.append(
    createElement('span', '', operation.category),
    createElement('span', '', `context:${operation.context}`),
    createElement('span', '', `files:${operation.files}`),
  );

  const requiredParameters = operation.parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name);
  if (requiredParameters.length > 0) {
    const compactRequired = requiredParameters.slice(0, 3).join(', ');
    const remainingCount = requiredParameters.length - 3;
    metadata.append(createElement('span', '', `requires:${compactRequired}${remainingCount > 0 ? ` +${remainingCount}` : ''}`));
  }

  const command = createElement('div', 'operation-command', `moodlia ${operation.command}`);
  card.append(header, heading, summary, metadata, command);
  return card;
}

function getSelectedOperationType() {
  return document.querySelector('input[name="operation-type"]:checked')?.value ?? '';
}

function filterOperationIndex() {
  const searchTerm = operationSearch?.value.trim().toLowerCase() ?? '';
  const selectedCategory = operationCategory?.value ?? '';
  const selectedType = getSelectedOperationType();
  const searchTokens = searchTerm.split(/\s+/).filter(Boolean);

  filteredOperations = operationIndex.operations
    .filter((operation) => !selectedCategory || operation.category === selectedCategory)
    .filter((operation) => !selectedType || operation.type === selectedType)
    .filter((operation) => {
      if (searchTokens.length === 0) {
        return true;
      }

      const searchableText = [
        operation.name,
        operation.command,
        operation.summary,
        operation.context,
        operation.category,
        ...operation.parameters.map((parameter) => parameter.name),
      ].join(' ').toLowerCase();
      return searchTokens.every((token) => searchableText.includes(token));
    })
    .sort((firstOperation, secondOperation) => firstOperation.name.localeCompare(secondOperation.name));
}

function renderOperationIndex({ announce = true } = {}) {
  if (!operationResults || !operationResultCount) {
    return;
  }

  filterOperationIndex();
  operationResults.replaceChildren();
  const visibleOperations = filteredOperations.slice(0, visibleOperationCount);

  if (visibleOperations.length === 0) {
    operationResults.append(createElement('p', 'empty-state', 'No operation matches those filters. Try a canonical noun such as course, book, quiz, user, grade, or backup.'));
  } else {
    const resultFragment = document.createDocumentFragment();
    visibleOperations.forEach((operation) => resultFragment.append(buildOperationCard(operation)));
    operationResults.append(resultFragment);
  }

  if (announce) {
    window.clearTimeout(searchAnnouncementTimeout);
    searchAnnouncementTimeout = window.setTimeout(() => {
      operationResultCount.textContent = String(filteredOperations.length);
    }, 120);
  } else {
    operationResultCount.textContent = String(filteredOperations.length);
  }

  if (operationLoadMore) {
    const remainingCount = filteredOperations.length - visibleOperations.length;
    operationLoadMore.hidden = remainingCount <= 0;
    operationLoadMore.textContent = remainingCount > 0
      ? `Show more operations (${remainingCount} remaining)`
      : 'Show more operations';
  }
}

function resetOperationPaginationAndRender() {
  visibleOperationCount = resultPageSize;
  renderOperationIndex();
}

function installOperationExplorer() {
  document.querySelectorAll('[data-operation-count]').forEach((element) => {
    element.textContent = String(operationIndex.operationCount);
  });

  if (contractVersion) {
    contractVersion.textContent = operationIndex.contractVersion;
  }

  if (!operationCategory || !operationSearch) {
    return;
  }

  const categories = [...new Set(operationIndex.operations.map((operation) => operation.category))].sort();
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    operationCategory.append(option);
  }

  operationSearch.addEventListener('input', resetOperationPaginationAndRender);
  operationCategory.addEventListener('change', resetOperationPaginationAndRender);
  document.querySelectorAll('input[name="operation-type"]').forEach((input) => {
    input.addEventListener('change', resetOperationPaginationAndRender);
  });

  operationLoadMore?.addEventListener('click', () => {
    visibleOperationCount += resultPageSize;
    renderOperationIndex({ announce: false });
    operationResults.querySelectorAll('.operation-card')[visibleOperationCount - resultPageSize]?.focus?.();
  });

  document.querySelectorAll('[data-operation-category]').forEach((link) => {
    link.addEventListener('click', () => {
      operationCategory.value = link.dataset.operationCategory;
      operationSearch.value = '';
      resetOperationPaginationAndRender();
    });
  });

  renderOperationIndex({ announce: false });
}

function focusOperationSearch() {
  if (!operationSearch) {
    return;
  }

  document.querySelector('#operations')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  window.setTimeout(() => operationSearch.focus(), 120);
}

function installKeyboardShortcuts() {
  document.querySelectorAll('[data-focus-operation-search]').forEach((button) => {
    button.addEventListener('click', focusOperationSearch);
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;

    if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      focusOperationSearch();
    }

    if (event.key === 'Escape') {
      if (navigationToggle?.getAttribute('aria-expanded') === 'true') {
        setNavigationOpen(false);
        navigationToggle.focus();
      } else if (document.activeElement === operationSearch && operationSearch.value) {
        operationSearch.value = '';
        resetOperationPaginationAndRender();
      }
    }
  });
}

installCodeCopyControls();
installTabs();
installNavigation();
installRevealAnimations();
installOperationExplorer();
installKeyboardShortcuts();
