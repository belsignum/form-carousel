<?php
declare(strict_types=1);

namespace Belsignum\FormCarousel\TypoScript;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Service\FlexFormService;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Frontend\ContentObject\ContentObjectRenderer;
use TYPO3\CMS\Form\Mvc\Persistence\FormPersistenceManagerInterface;

final class FormStepsUtil
{
    /**
     * Returns ' data-steps="N"' (with leading space) or ''.
     * v12-safe: 3rd arg may be ContentObjectRenderer OR ServerRequestInterface.
     */
    public function stepsAttr(
        string $content,
        array $conf,
        ContentObjectRenderer|ServerRequestInterface $third
    ): string {
        // Resolve current row
        $row = [];
        if ($third instanceof ContentObjectRenderer) {
            $row = $third->data ?? [];
        } else {
            $cObj = $third->getAttribute('currentContentObject');
            $row  = $cObj instanceof ContentObjectRenderer ? ($cObj->data ?? []) : ($third->getAttribute('currentContentObjectData') ?? []);
        }

        try {
            $piFlexXml  = (string)($row['pi_flexform'] ?? '');
            /** @var FlexFormService $flexSrv */
            $flexSrv    = GeneralUtility::makeInstance(FlexFormService::class);
            $flex       = $flexSrv->convertFlexFormContentToArray($piFlexXml) ?? [];
            $identifier = (string)($flex['settings']['persistenceIdentifier'] ?? '');

            if ($identifier !== '') {
                /** @var FormPersistenceManagerInterface $pm */
                $pm    = GeneralUtility::makeInstance(FormPersistenceManagerInterface::class);
                $def   = $pm->load($identifier); // YAML as array
                $pages = is_array($def['renderables'] ?? null) ? $def['renderables'] : [];
                $steps = count($pages);
                return $steps > 0 ? (' data-steps="' . $steps . '"') : '';
            }
        } catch (\Throwable) {
            // ignore and return empty
        }
        return '';
    }
}
