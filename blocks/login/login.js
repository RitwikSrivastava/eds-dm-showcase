const LOGIN_ENDPOINT = '/auth/login';
const DEFAULT_REDIRECT = '/subscription';

/**
 * Returns the post-login target, limited to same-origin paths to avoid open redirects.
 * @returns {string}
 */
function getRedirectTarget() {
  const target = new URLSearchParams(window.location.search).get('redirect');
  if (target && /^\/(?![/\\])/.test(target)) {
    return target;
  }
  return DEFAULT_REDIRECT;
}

function createField(id, label, type, autocomplete) {
  const wrapper = document.createElement('div');
  wrapper.className = 'login-field';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;

  const input = document.createElement('input');
  Object.assign(input, {
    id, name: id, type, required: true, autocomplete,
  });

  wrapper.append(labelEl, input);
  return wrapper;
}

export default function decorate(block) {
  const form = document.createElement('form');
  form.className = 'login-form';

  const error = document.createElement('p');
  error.className = 'login-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button';
  submit.textContent = 'Log in';

  form.append(
    createField('username', 'Username', 'text', 'username'),
    createField('password', 'Password', 'password', 'current-password'),
    error,
    submit,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;

    try {
      const resp = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.value,
          password: form.password.value,
        }),
      });
      if (!resp.ok) {
        error.textContent = resp.status === 401
          ? 'Invalid username or password.'
          : 'Login failed. Please try again.';
        error.hidden = false;
        return;
      }
      window.location.assign(getRedirectTarget());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Login request failed', err);
      error.textContent = 'Login failed. Please try again.';
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  block.replaceChildren(form);
}
