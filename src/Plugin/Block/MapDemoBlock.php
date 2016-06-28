<?php

/**
 * @file
 * Contains \Drupal\zee_map\Plugin\Block\MapBlock.
 */

namespace Drupal\zee_map\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Provides a 'MapDempBlock' block.
 *
 * @Block(
 *  id = "zee_map_demo_block",
 *  admin_label = @Translation("Zee Map Demo Block"),
 * )
 */
class MapDemoBlock extends BlockBase {

  /**
   * {@inheritdoc}
   */
  public function build() {
    $build = [];

    return $build;
  }

}
